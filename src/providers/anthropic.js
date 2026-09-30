// Adapter Claude (Anthropic). Mengubah riwayat "netral" <-> format Messages API,
// menjalankan tool-loop dengan streaming teks.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";
import { MAX_STEPS, badArgsMessage, looksLikeUnfinishedAction, NUDGE_TEXT, CONTINUE_TEXT, EMPTY_TEXT } from "./toolkit.js";

// Ubah turn netral -> messages Anthropic.
function toAnthropic(turns) {
  const msgs = [];
  for (const t of turns) {
    if (t.role === "user") {
      if (t.images && t.images.length) {
        const content = [{ type: "text", text: t.text }];
        for (const im of t.images) content.push({ type: "image", source: { type: "base64", media_type: im.media_type, data: im.data } });
        msgs.push({ role: "user", content });
      } else {
        msgs.push({ role: "user", content: t.text });
      }
    } else if (t.role === "assistant") {
      const content = [];
      if (t.text) content.push({ type: "text", text: t.text });
      for (const tc of t.toolCalls || []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
      }
      msgs.push({ role: "assistant", content });
    } else if (t.role === "tool") {
      msgs.push({
        role: "user",
        content: (t.results || []).map((r) => ({
          type: "tool_result",
          tool_use_id: r.id,
          content: r.output,
        })),
      });
    }
  }
  return msgs;
}

export function createProvider(pconf) {
  let client;
  if (pconf.authToken && !pconf.apiKey) {
    // OAuth "SSO resmi": bearer token + beta header oauth.
    client = new Anthropic({
      authToken: pconf.authToken,
      defaultHeaders: { "anthropic-beta": "oauth-2025-04-20" },
    });
  } else {
    // API key (dibaca otomatis dari ANTHROPIC_API_KEY bila apiKey null).
    client = new Anthropic(pconf.apiKey ? { apiKey: pconf.apiKey } : {});
  }

  return {
    label: pconf.label,
    model: pconf.model,

    async run({ system, turns, tools, runSkill, onDelta, onEvent, signal }) {
      const history = [...turns];
      let usageAcc = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
      // Prompt caching (roadmap: LLM > Prompt Caching): cache system prompt yang stabil.
      const systemParam = config.promptCache
        ? [{ type: "text", text: system, cache_control: { type: "ephemeral" } }]
        : system;
      const apiTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
      let finalText = "";
      const notice = (message) => { try { onEvent?.({ type: "notice", message }); } catch {} };
      let nudged = false, continues = 0, emptyNudged = false, usedTools = false;

      for (let step = 1; ; step++) {
        signal?.throwIfAborted();
        if (step > MAX_STEPS) {
          notice(`Batas ${MAX_STEPS} langkah tool per giliran tercapai — berhenti.`);
          return { text: finalText.trim() || "(berhenti: terlalu banyak langkah tool)", turns: history, usage: usageAcc };
        }
        onEvent?.({ type: "model_start", step });
        const stream = client.messages.stream({
          model: pconf.model,
          max_tokens: config.maxTokens,
          thinking: { type: "adaptive" },
          output_config: { effort: config.effort },
          system: systemParam,
          tools: apiTools,
          messages: toAnthropic(history),
        }, { signal });
        stream.on("text", (d) => {
          finalText += d;
          onDelta?.(d);
        });
        let argChars = 0;
        stream.on("inputJson", (partial) => {
          argChars += (partial || "").length;
          const cur = stream.currentMessage?.content?.at?.(-1);
          try { onEvent?.({ type: "tool_args", name: cur?.name || "tool", size: argChars }); } catch {}
        });
        const msg = await stream.finalMessage();
        if (msg.usage) {
          usageAcc.input_tokens += msg.usage.input_tokens || 0;
          usageAcc.output_tokens += msg.usage.output_tokens || 0;
          usageAcc.cache_read_input_tokens += msg.usage.cache_read_input_tokens || 0;
        }

        const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        const toolCalls = msg.content
          .filter((b) => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: b.input }));

        history.push({ role: "assistant", text, toolCalls });

        if (msg.stop_reason === "refusal") {
          return { text: finalText || "(permintaan ditolak oleh model)", turns: history, usage: usageAcc };
        }
        const truncated = msg.stop_reason === "max_tokens";
        if (toolCalls.length) {
          // Tool call yang terpotong batas output tidak dijalankan — model diminta menulis bertahap.
          const results = [];
          for (const [i, tc] of toolCalls.entries()) {
            signal?.throwIfAborted();
            if (truncated && i === toolCalls.length - 1) {
              notice(`Isi ${tc.name} terpotong batas output model — meminta model menulis bertahap.`);
              results.push({ id: tc.id, name: tc.name, output: badArgsMessage(tc.name, true, argChars) });
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
        return { text: finalText.trim(), turns: history, usage: usageAcc };
      }
    },
  };
}
