// Skill: cari teks/regex di seluruh proyek (grep, read-only). Untuk menemukan
// definisi/pemakaian sebelum mengubah kode — biar akurat & tak merusak yang lain.
import fs from "node:fs";
import path from "node:path";

const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "vendor", "coverage", ".cache"]);
const TEXT_EXT = new Set([".js",".jsx",".ts",".tsx",".mjs",".cjs",".json",".php",".blade.php",".css",".scss",".html",".vue",".svelte",".py",".go",".rs",".java",".rb",".md",".yml",".yaml",".env",".sql",".sh"]);

function walk(dir, out, cap) {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (out.length >= cap) return;
    if (ent.name.startsWith(".") && ent.name !== ".env") { /* skip dotfiles kecuali .env */ }
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) { if (!SKIP_DIR.has(ent.name)) walk(full, out, cap); }
    else out.push(full);
  }
}

export default {
  name: "search_code",
  description:
    "Cari teks atau regex di seluruh file proyek (mirip grep, read-only). Kembalikan lokasi path:baris. Panggil untuk menemukan definisi fungsi/komponen/pemakaian sebelum mengubah kode.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Teks atau pola regex yang dicari." },
      dir: { type: "string", description: "Folder awal (default: direktori kerja saat ini)." },
      regex: { type: "boolean", description: "true bila query adalah regex (default false = substring)." },
      max: { type: "number", description: "Maks hasil (default 60)." },
    },
    required: ["query"],
  },
  async run(input) {
    const base = input.dir || process.cwd();
    const max = Math.min(input.max || 60, 200);
    let re;
    try { re = input.regex ? new RegExp(input.query, "i") : null; } catch (e) { return `Regex tidak valid: ${e.message}`; }
    const q = input.query.toLowerCase();

    const files = [];
    walk(base, files, 5000);
    const hits = [];
    for (const f of files) {
      if (hits.length >= max) break;
      const ext = path.extname(f);
      if (![...TEXT_EXT].some((x) => f.endsWith(x)) && !TEXT_EXT.has(ext)) continue;
      let content;
      try { content = fs.readFileSync(f, "utf8"); } catch { continue; }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length && hits.length < max; i++) {
        const line = lines[i];
        const ok = re ? re.test(line) : line.toLowerCase().includes(q);
        if (ok) hits.push(`${path.relative(base, f)}:${i + 1}: ${line.trim().slice(0, 160)}`);
      }
    }
    if (!hits.length) return `Tidak ada kecocokan untuk "${input.query}" di ${base}.`;
    return `${hits.length} kecocokan (maks ${max}):\n` + hits.join("\n");
  },
};
