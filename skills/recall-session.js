// Skill: cari & baca transkrip sesi percakapan sebelumnya (di ~/.ai-agent-traga/data/sessions).
// Melengkapi 'recall' (yang hanya baca fakta memory.json) — ini baca isi obrolan lampau.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

function sessionsDir() { return path.join(config.dataDir, "sessions"); }
function listFiles() {
  try { return fs.readdirSync(sessionsDir()).filter((f) => f.endsWith(".json")).sort().reverse(); } catch { return []; }
}
function turnText(t) {
  if (!t) return "";
  if (t.role === "user") return "User: " + (t.text || "");
  if (t.role === "assistant") return "Solvatra: " + (t.text || "");
  if (t.role === "tool") return "[tool: " + (t.results || []).map((r) => r.name).join(", ") + "]";
  return "";
}

export default {
  name: "recall_session",
  description:
    "Cari & baca transkrip percakapan SESI SEBELUMNYA (bukan cuma fakta memori). Pakai saat user menyinggung sesuatu yang 'dibahas sebelumnya' atau minta lanjut sesi lampau. action 'search' (butuh query) mencari kata kunci di semua sesi; action 'last' menampilkan sesi terbaru; action 'list' menampilkan daftar sesi.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["search", "last", "list"], description: "search | last | list (default search bila ada query, else last)" },
      query: { type: "string", description: "Kata kunci untuk action 'search'." },
      max: { type: "number", description: "Maks hasil/baris (default 40)." },
    },
  },
  async run(input) {
    const files = listFiles();
    if (!files.length) return "Belum ada sesi tersimpan.";
    const max = Math.min(input.max || 40, 200);
    const action = input.action || (input.query ? "search" : "last");

    if (action === "list") {
      const rows = files.slice(0, 30).map((f) => {
        let n = 0; try { n = JSON.parse(fs.readFileSync(path.join(sessionsDir(), f), "utf8")).length; } catch {}
        return `- ${f.replace(".json", "")}  (${n} turn)`;
      });
      return `Sesi tersimpan (terbaru dulu):\n` + rows.join("\n");
    }

    if (action === "last") {
      for (const f of files) {
        let turns = []; try { turns = JSON.parse(fs.readFileSync(path.join(sessionsDir(), f), "utf8")); } catch {}
        if (turns.length) {
          const lines = turns.map(turnText).filter(Boolean).slice(-max);
          return `Sesi terakhir (${f.replace(".json", "")}):\n` + lines.join("\n");
        }
      }
      return "Semua sesi tersimpan masih kosong.";
    }

    // search
    const q = String(input.query || "").toLowerCase();
    if (!q) return "action 'search' butuh query.";
    const hits = [];
    for (const f of files) {
      let turns = []; try { turns = JSON.parse(fs.readFileSync(path.join(sessionsDir(), f), "utf8")); } catch {}
      turns.forEach((t, i) => {
        const line = turnText(t);
        if (line.toLowerCase().includes(q)) hits.push(`[${f.replace(".json", "")} #${i}] ${line.slice(0, 200)}`);
      });
      if (hits.length >= max) break;
    }
    if (!hits.length) return `Tidak ada sesi yang menyebut "${input.query}". (Mungkin sesi itu tak sempat tersimpan.)`;
    return `${hits.length} kecocokan untuk "${input.query}":\n` + hits.slice(0, max).join("\n");
  },
};
