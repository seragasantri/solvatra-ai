// Skill: baca folder frontend-template/, daftar template, muat isi template terpilih.
import fs from "node:fs";
import path from "node:path";

function listTemplates(dir) {
  let names = [];
  try { names = fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name); }
  catch { return []; }
  return names.map((name) => {
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(path.join(dir, name, "template.json"), "utf8")); } catch {}
    return { name, title: meta.title || name, description: meta.description || "", stack: meta.origin_stack || "", components: meta.components || [] };
  });
}

function readAllFiles(base) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else out.push({ path: path.relative(base, full), content: fs.readFileSync(full, "utf8") });
    }
  };
  walk(base);
  return out;
}

export default {
  name: "frontend_template",
  description:
    "Kelola template frontend di folder frontend-template/. action 'list' menampilkan template yang tersedia; action 'load' (butuh 'template') memuat manifest + design guide + semua file skeleton template itu agar bisa direplikasi/diadaptasi.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "load"], description: "list = daftar template; load = muat satu template." },
      template: { type: "string", description: "Nama folder template (untuk action 'load'), mis. 'simobe-lpm'." },
    },
    required: ["action"],
  },
  async run(input, ctx) {
    const dirs = ctx.config.templatesDirs || [ctx.config.templatesDir];
    if (input.action === "list") {
      const seen = new Set();
      const items = [];
      for (const d of dirs) for (const it of listTemplates(d)) {
        if (!seen.has(it.name)) { seen.add(it.name); items.push(it); }
      }
      if (!items.length) return "Belum ada template di folder frontend-template/.";
      return JSON.stringify(items, null, 2);
    }
    if (input.action === "load") {
      const name = String(input.template || "").trim();
      if (!/^[a-zA-Z0-9_-]+$/.test(name)) return "Nama template tidak valid.";
      let base = null;
      for (const d of dirs) {
        const cand = path.join(d, name);
        if (path.dirname(path.resolve(cand)) === path.resolve(d) && fs.existsSync(cand)) { base = cand; break; }
      }
      if (!base) return `Template "${name}" tidak ditemukan. Jalankan action 'list' dulu.`;
      const files = readAllFiles(base);
      return JSON.stringify({ template: name, files }, null, 2);
    }
    return "action tidak dikenal (pakai 'list' atau 'load').";
  },
};
