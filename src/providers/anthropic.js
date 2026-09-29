// Adapter Claude (Anthropic). Mengubah riwayat "netral" <-> format Messages API,
// menjalankan tool-loop dengan streaming teks.
import Anthropic from "@anthropic-ai/sdk";
import { config } from "../config.js";

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

    async run({ system, turns, tools, runSkill, onDelta }) {
      const history = [...turns];
      const apiTools = tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }));
      let finalText = "";

      while (true) {
        const stream = client.messages.stream({
          model: pconf.model,
          max_tokens: config.maxTokens,
          thinking: { type: "adaptive" },
          output_config: { effort: config.effort },
          system,
          tools: apiTools,
          messages: toAnthropic(history),
        });
        stream.on("text", (d) => {
          finalText += d;
          onDelta?.(d);
        });
        const msg = await stream.finalMessage();

        const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
        const toolCalls = msg.content
          .filter((b) => b.type === "tool_use")
          .map((b) => ({ id: b.id, name: b.name, input: b.input }));

        history.push({ role: "assistant", text, toolCalls });

        if (msg.stop_reason === "refusal") {
          return { text: finalText || "(permintaan ditolak oleh model)", turns: history };
        }
        if (msg.stop_reason !== "tool_use") {
          return { text: finalText.trim(), turns: history };
        }

        const results = [];
        for (const tc of toolCalls) {
          const output = await runSkill(tc.name, tc.input);
          results.push({ id: tc.id, name: tc.name, output });
        }
        history.push({ role: "tool", results });
      }
    },
  };
}
