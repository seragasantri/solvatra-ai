// Adapter untuk endpoint OpenAI-compatible (/chat/completions).
// Dipakai provider "codex" (OpenAI resmi) & "custom" (router/gateway bebas).
// Tanpa dependency: fetch bawaan Node + parsing SSE manual. Mendukung function calling.
import { config } from "../config.js";

// Ubah turn netral -> messages OpenAI.
function toOpenAI(system, turns) {
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
      for (const r of t.results || []) {
        msgs.push({ role: "tool", tool_call_id: r.id, content: r.output });
      }
    }
  }
  return msgs;
}

// Baca body SSE, akumulasi teks + tool_calls (yang datang bertahap per-index).
async function readStream(res, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  const toolAcc = new Map(); // index -> {id,name,argStr}
  let finishReason = null;
  let usage = null;

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
      const choice = json.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta || {};
      if (delta.content) { text += delta.content; onDelta?.(delta.content); }
      for (const tc of delta.tool_calls || []) {
        const idx = tc.index ?? 0;
        const acc = toolAcc.get(idx) || { id: null, name: "", argStr: "" };
        if (tc.id) acc.id = tc.id;
        if (tc.function?.name) acc.name += tc.function.name;
        if (tc.function?.arguments) acc.argStr += tc.function.arguments;
        toolAcc.set(idx, acc);
      }
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }

  const toolCalls = [...toolAcc.values()].map((a) => {
    let input = {};
    try { input = a.argStr ? JSON.parse(a.argStr) : {}; } catch { input = {}; }
    return { id: a.id || `call_${Math.random().toString(36).slice(2)}`, name: a.name, input };
  });
  return { text, toolCalls, finishReason, usage };
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

  return {
    label: pconf.label,
    model: pconf.model,

    async run({ system, turns, tools, runSkill, onDelta }) {
      const history = [...turns];
      let usageAcc = { input_tokens: 0, output_tokens: 0 };
      const apiTools = tools.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.input_schema },
      }));

      while (true) {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model: pconf.model,
            max_tokens: config.maxTokens,
            stream: true,
            ...(config.temperature != null && !Number.isNaN(config.temperature) ? { temperature: config.temperature } : {}),
            ...(config.topP != null && !Number.isNaN(config.topP) ? { top_p: config.topP } : {}),
            ...(config.topK != null && !Number.isNaN(config.topK) ? { top_k: config.topK } : {}),
            ...(config.frequencyPenalty != null && !Number.isNaN(config.frequencyPenalty) ? { frequency_penalty: config.frequencyPenalty } : {}),
            ...(config.presencePenalty != null && !Number.isNaN(config.presencePenalty) ? { presence_penalty: config.presencePenalty } : {}),
            stream_options: { include_usage: true },
            messages: toOpenAI(system, history),
            tools: apiTools.length ? apiTools : undefined,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} dari ${url}: ${body.slice(0, 300)}`);
        }

        const { text, toolCalls, finishReason, usage } = await readStream(res, onDelta);
        if (usage) { usageAcc.input_tokens += usage.prompt_tokens || 0; usageAcc.output_tokens += usage.completion_tokens || 0; }
        history.push({ role: "assistant", text, toolCalls });

        if (finishReason === "tool_calls" && toolCalls.length) {
          const results = [];
          for (const tc of toolCalls) {
            const output = await runSkill(tc.name, tc.input);
            results.push({ id: tc.id, name: tc.name, output });
          }
          history.push({ role: "tool", results });
          continue;
        }
        return { text: text.trim(), turns: history, usage: usageAcc };
      }
    },
  };
}
