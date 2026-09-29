// Skill: lihat struktur folder (read-only), untuk memahami layout proyek.
import fs from "node:fs";
import path from "node:path";

const SKIP = new Set(["node_modules", ".git", "dist", "build", ".next", "vendor", "coverage", ".cache"]);

function tree(dir, prefix, depth, maxDepth, out, cap) {
  if (depth > maxDepth || out.length >= cap) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  entries.sort((a, b) => (b.isDirectory() - a.isDirectory()) || a.name.localeCompare(b.name));
  for (const ent of entries) {
    if (out.length >= cap) return;
    if (SKIP.has(ent.name)) { out.push(`${prefix}${ent.name}/ …(dilewati)`); continue; }
    out.push(`${prefix}${ent.name}${ent.isDirectory() ? "/" : ""}`);
    if (ent.isDirectory()) tree(path.join(dir, ent.name), prefix + "  ", depth + 1, maxDepth, out, cap);
  }
}

export default {
  name: "list_dir",
  description: "Tampilkan struktur folder proyek (read-only) untuk memahami layout sebelum ngoding.",
  input_schema: {
    type: "object",
    properties: {
      dir: { type: "string", description: "Folder (default: direktori kerja saat ini)." },
      depth: { type: "number", description: "Kedalaman maks (default 3)." },
    },
  },
  async run(input) {
    const base = input.dir || process.cwd();
    if (!fs.existsSync(base)) return `Folder tidak ditemukan: ${base}`;
    const out = [];
    tree(base, "", 1, Math.min(input.depth || 3, 6), out, 400);
    return `${base}\n` + out.join("\n");
  },
};
