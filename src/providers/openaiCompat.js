// Adapter untuk endpoint OpenAI-compatible (/chat/completions).
// Dipakai provider "solvatra", "codex" (OpenAI resmi) & "custom" (router/gateway bebas).
// Tanpa dependency: fetch bawaan Node + parsing SSE manual.
//
// Andal untuk model apa pun:
// - function calling native; bila upstream menolak `tools`, otomatis beralih ke mode
//   "prompt tools" (<tool_call>{…}</tool_call> di teks) untuk sisa sesi;
// - tool dijalankan setiap kali ada tool_calls, apa pun finish_reason-nya;
// - argumen terpotong/rusak tidak pernah dijalankan diam-diam sebagai {} — model diberi
//   tahu dan diminta menulis bertahap;
// - output terpotong (finish_reason "length") dilanjutkan otomatis;
// - model yang hanya "mengumumkan" tanpa memanggil tool didorong sekali untuk bertindak.
import { config } from "../config.js";
import {
  MAX_STEPS, promptToolsSystem, parseTextToolCalls, makeTagFilter, badArgsMessage,
  looksLikeUnfinishedAction, NUDGE_TEXT, CONTINUE_TEXT, EMPTY_TEXT, parseToolArgs, normalizeToolCall,
} from "./toolkit.js";
import fs from "node:fs";
import path from "node:path";

// Argumen tool yang tetap gagal di-parse dicatat (potongan awal & akhir) untuk diagnosis.
function logBadArgs(rec) {
  try { fs.appendFileSync(path.join(config.logsDir, "bad-tool-args.jsonl"), JSON.stringify({ ts: new Date().toISOString(), ...rec }) + "\n"); } catch {}
}

// Ubah turn netral -> messages OpenAI. promptTools: tool call/hasil dirender sebagai teks.
function toOpenAI(system, turns, promptTools) {
  const msgs = [{ role: "system", content: system }];
  for (const t of turns) {
    if (t.role === "user") {
      if (t.images && t.images.length) {
        const content = [{ type: "text", text: t.text }];
        for (const im of t.images) content.push({ type: "image_url", image_url: { url: `data:${im.media_type};base64,${im.data}` } });
        msgs.push({ role: "user", content });
      } else {
        msgs.push({ role: "user", content: t.text });
      }
    } else if (t.role === "assistant") {
      // Jawaban kosong (mis. habis untuk "berpikir") tidak dikirim balik: banyak upstream
      // menolak pesan asisten tanpa isi & tanpa tool call ("content must not be empty").
      if (!(t.text || "").trim() && !t.toolCalls?.length) continue;
      if (promptTools) {
        const calls = (t.toolCalls || []).map((tc) => `<tool_call>${JSON.stringify({ name: tc.name, arguments: tc.input ?? {} })}</tool_call>`);
        msgs.push({ role: "assistant", content: [t.text || "", ...calls].filter(Boolean).join("\n") || "(memanggil tool)" });
        continue;
      }
      const m = { role: "assistant", content: t.text || null };
      if (t.toolCalls?.length) {
        m.tool_calls = t.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.input ?? {}) },
        }));
      }
      msgs.push(m);
    } else if (t.role === "tool") {
      if (promptTools) {
        const body = (t.results || []).map((r) => `[Hasil tool ${r.name}]\n${r.output}`).join("\n\n");
        msgs.push({ role: "user", content: body });
        continue;
      }
      for (const r of t.results || []) {
        msgs.push({ role: "tool", tool_call_id: r.id, content: r.output });
      }
    }
  }
  return msgs;
}

const isCompleteJson = (s) => { if (!s || !s.trim()) return false; try { JSON.parse(s); return true; } catch { return false; } };

// Baca body SSE, akumulasi teks + tool_calls (yang datang bertahap per-index).
async function readStream(res, { onText, onToolArgs }) {
  // Sebagian upstream mengirim dua tool call paralel dengan index yang sama (atau tanpa index),
  // mengulang nama tool utuh, atau mengirim argumen kumulatif. Dirakit hati-hati supaya tidak
  // jadi "write_filewrite_file" dengan argumen tergabung.
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  const calls = [];            // urutan tool call yang dirakit
  const current = new Map();   // index -> accumulator aktif
  let finishReason = null;
  let usage = null;
  let streamError = null; // gateway/upstream memutus aliran di tengah jalan

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const payload = s.slice(5).trim();
      if (payload === "[DONE]") continue;
      let json;
      try { json = JSON.parse(payload); } catch { continue; }
      if (json.usage) usage = json.usage;
      if (json.error) { streamError = json.error.message || "aliran terputus"; continue; }
      const choice = json.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) { text += delta.content; onText?.(delta.content); }
      for (const tc of delta.tool_calls || []) {
        const idx = tc.index ?? 0;
        let acc = current.get(idx);
        const name = tc.function?.name || "";
        const args = tc.function?.arguments || "";
        // Tool call berikutnya bila: id berbeda, atau nama muncul lagi padahal argumen sebelumnya
        // sudah JSON utuh (nama yang diulang di tengah argumen = masih call yang sama).
        const isNew = !acc || (tc.id && acc.id && tc.id !== acc.id) || (name && acc.name && isCompleteJson(acc.argStr));
        if (isNew) { acc = { id: null, name: "", argStr: "" }; calls.push(acc); current.set(idx, acc); }
        if (tc.id) acc.id = tc.id;
        if (name && name !== acc.name) acc.name += name; // nama utuh yang diulang tidak digandakan
        if (args) acc.argStr = acc.argStr && args.length > acc.argStr.length && args.startsWith(acc.argStr) ? args : acc.argStr + args;
        onToolArgs?.(acc.name, acc.argStr.length);
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = calls.filter((a) => a.name).map((a) => {
    const parsed = parseToolArgs(a.argStr);
    return {
      id: a.id || `call_${Math.random().toString(36).slice(2)}`, name: a.name,
      input: parsed.ok ? parsed.value : {}, bad: !parsed.ok, error: parsed.error, raw: parsed.ok ? null : a.argStr,
      size: a.argStr.length,
    };
  });
  return { text, toolCalls, finishReason, usage, streamError };
}

export function createProvider(pconf) {
  if (!pconf.baseUrl) throw new Error(`Provider "${config.provider}": base URL belum di-set.`);
  if (!pconf.model) throw new Error(`Provider "${config.provider}": model belum di-set.`);

  const headers = { "Content-Type": "application/json" };
  if (pconf.apiKey) headers.Authorization = `Bearer ${pconf.apiKey}`;
  if (pconf.extraHeaders) {
    try { Object.assign(headers, JSON.parse(pconf.extraHeaders)); } catch { /* abaikan */ }
  }
  const url = pconf.baseUrl.replace(/\/$/, "") + "/chat/completions";
  // Diingat per instance provider (= per model): sekali upstream menolak tools native,
  // giliran berikutnya langsung pakai mode prompt-tools.
  const state = { promptTools: false };

  return {
    label: pconf.label,
    model: pconf.model,

    async run({ system, turns, tools, runSkill, onDelta, onEvent, signal }) {
      const history = [...turns];
      const usageAcc = { input_tokens: 0, output_tokens: 0 };
      const apiTools = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));
      const toolNames = tools.map((t) => t.name);
      const notice = (msg) => { try { onEvent?.({ type: "notice", message: msg }); } catch {} };
      let triedPromptMode = false, nudged = false, continues = 0, emptyNudged = false, usedTools = false, retriesCut = 0, retriesHttp = 0;
      let maxTokens = config.maxTokens;
      // mode cepat: penalaran singkat; "none" dipakai bila model tetap menghabiskan batas untuk berpikir
      let effort = config.reasoning === "deep" ? null : "low";

      for (let step = 1; ; step++) {
        signal?.throwIfAborted();
        if (step > MAX_STEPS) {
          notice(`Batas ${MAX_STEPS} langkah tool per giliran tercapai — berhenti.`);
          return { text: "(berhenti: terlalu banyak langkah tool dalam satu giliran)", turns: history, usage: usageAcc };
        }
        const promptTools = state.promptTools && apiTools.length > 0;
        const sys = promptTools ? system + promptToolsSystem(tools) : system;

        const res = await fetch(url, {
          method: "POST",
          headers,
          signal,
          body: JSON.stringify({
            model: pconf.model,
            max_tokens: maxTokens,
            ...(effort ? { reasoning_effort: effort } : {}),
            stream: true,
            ...(config.temperature != null && !Number.isNaN(config.temperature) ? { temperature: config.temperature } : {}),
            ...(config.topP != null && !Number.isNaN(config.topP) ? { top_p: config.topP } : {}),
            ...(config.topK != null && !Number.isNaN(config.topK) ? { top_k: config.topK } : {}),
            ...(config.frequencyPenalty != null && !Number.isNaN(config.frequencyPenalty) ? { frequency_penalty: config.frequencyPenalty } : {}),
            ...(config.presencePenalty != null && !Number.isNaN(config.presencePenalty) ? { presence_penalty: config.presencePenalty } : {}),
            stream_options: { include_usage: true },
            messages: toOpenAI(sys, history, promptTools),
            tools: !promptTools && apiTools.length ? apiTools : undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // Beralih ke mode prompt-tools HANYA bila upstream jelas menolak function calling.
          // (Dulu semua 4xx/5xx dianggap begitu — satu error biasa membuat sisa sesi rusak.)
          const rejectsTools = /tool|function[_ ]?call/i.test(body);
          if (!promptTools && apiTools.length && !triedPromptMode && [400, 404, 422].includes(res.status) && rejectsTools) {
            triedPromptMode = true;
            state.promptTools = true;
            notice("Model ini tidak menerima tool native — beralih ke mode tool kompatibel.");
            step--;
            continue;
          }
          // Gangguan sesaat di server: ulangi langkah yang sama (maks 2x per giliran).
          if ([429, 500, 502, 503, 504].includes(res.status) && retriesHttp < 2) {
            retriesHttp++;
            notice(`Server model sibuk/bermasalah (HTTP ${res.status}) — mencoba lagi…`);
            await new Promise((r) => setTimeout(r, 1500 * retriesHttp));
            step--;
            continue;
          }
          let msg = body.slice(0, 300);
          try { msg = JSON.parse(body).error?.message || msg; } catch {}
          throw new Error(`HTTP ${res.status} dari ${url}: ${msg}`);
        }

        onEvent?.({ type: "model_start", step });
        const filter = promptTools ? makeTagFilter((s) => onDelta?.(s)) : null;
        const r = await readStream(res, {
          onText: (d) => (filter ? filter.push(d) : onDelta?.(d)),
          onToolArgs: (name, size) => { try { onEvent?.({ type: "tool_args", name, size }); } catch {} },
        });
        filter?.flush();
        if (r.usage) { usageAcc.input_tokens += r.usage.prompt_tokens || 0; usageAcc.output_tokens += r.usage.completion_tokens || 0; }

        // Aliran terputus (event error, atau berhenti tanpa finish_reason dengan tool call setengah jadi):
        // potongan ini tidak dipakai sama sekali — langkah yang sama diulang dari awal.
        const cut = r.streamError || (!r.finishReason && r.toolCalls.some((tc) => tc.bad));
        if (cut && retriesCut < 2) {
          retriesCut++;
          notice(`Koneksi ke model terputus di tengah jawaban${r.streamError ? ` (${r.streamError})` : ""} — mengulang langkah ini…`);
          step--;
          continue;
        }
        if (cut) throw new Error(`Koneksi ke model terputus berulang kali${r.streamError ? `: ${r.streamError}` : ""}. Coba lagi, atau pilih model lain dengan /model.`);

        let text = r.text;
        // Nama/argumen yang dibentuk salah oleh parser upstream dipulihkan dulu.
        let toolCalls = r.toolCalls.map((tc) => (tc.bad ? tc : normalizeToolCall(tc, toolNames)));
        toolCalls = toolCalls.map((tc) => {
          if (!tc.bad || !String(tc.name).trim().startsWith("{")) return tc;
          const fixed = normalizeToolCall({ ...tc, input: {} }, toolNames);
          return toolNames.includes(fixed.name) ? { ...fixed, bad: false } : tc;
        });
        // Tool call berbentuk teks (mode prompt, atau model yang menulisnya di content).
        if (!toolCalls.length && apiTools.length) {
          const parsed = parseTextToolCalls(text, toolNames);
          if (parsed.calls.length) { toolCalls = parsed.calls; text = parsed.text; }
        }
        // "Unterminated string" tanpa finish_reason length tetap berarti isinya terpotong.
        const truncated = r.finishReason === "length" || toolCalls.some((tc) => tc.bad && /unterminated|unexpected end/i.test(tc.error || ""));

        history.push({ role: "assistant", text, toolCalls: toolCalls.map(({ id, name, input }) => ({ id, name, input })) });

        if (toolCalls.length) {
          // Setiap tool call SELALU diberi hasil, supaya riwayat tetap valid untuk giliran berikutnya.
          const results = [];
          for (const tc of toolCalls) {
            signal?.throwIfAborted();
            if (tc.bad) {
              logBadArgs({ model: pconf.model, name: tc.name, finishReason: r.finishReason, size: tc.size, error: tc.error,
                head: String(tc.raw).slice(0, 800), tail: String(tc.raw).slice(-400) });
              const output = badArgsMessage(tc.name, truncated, tc.size, tc.error);
              notice(truncated
                ? `Isi ${tc.name} terpotong batas output model (${(tc.size / 1024).toFixed(1)} KB) — meminta model menulis bertahap.`
                : `Argumen ${tc.name} rusak — meminta model mengulang.`);
              results.push({ id: tc.id, name: tc.name, output });
              continue;
            }
            const output = await runSkill(tc.name, tc.input);
            results.push({ id: tc.id, name: tc.name, output });
          }
          history.push({ role: "tool", results });
          usedTools = true;
          continue;
        }

        if (usedTools && !text.trim() && !emptyNudged) {
          emptyNudged = true;
          notice("Model berhenti tanpa jawaban — meminta melanjutkan…");
          history.push({ role: "user", text: EMPTY_TEXT, synthetic: true });
          continue;
        }
        if (truncated && !text.trim() && !toolCalls.length && effort !== "none") {
          // batas habis untuk "berpikir" saja: matikan penalaran dulu — jauh lebih cepat
          // daripada melipatgandakan batas (dulu bisa 8k→16k→32k token = belasan menit)
          effort = "none";
          history.pop();
          notice("Model terlalu lama berpikir tanpa menjawab — mengulang tanpa penalaran panjang…");
          step--;
          continue;
        }
        if (truncated && !text.trim() && !toolCalls.length && maxTokens < 16000) {
          maxTokens = Math.min(16000, maxTokens * 2);
          history.pop(); // buang jawaban kosong
          notice(`Model kehabisan batas token sebelum menjawab — mengulang dengan batas ${maxTokens}…`);
          step--;
          continue;
        }
        if (truncated && continues < 3) {
          continues++;
          notice("Jawaban terpotong batas output — melanjutkan otomatis…");
          history.push({ role: "user", text: CONTINUE_TEXT, synthetic: true });
          continue;
        }
        if (!nudged && apiTools.length && looksLikeUnfinishedAction(text)) {
          nudged = true;
          notice("Model baru menjelaskan tanpa bertindak — meminta eksekusi…");
          history.push({ role: "user", text: NUDGE_TEXT, synthetic: true });
          continue;
        }
        return { text: text.trim(), turns: history, usage: usageAcc };
      }
    },
  };
}
