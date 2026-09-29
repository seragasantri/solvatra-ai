// Util bersama untuk skill keamanan (read-only). Bukan skill (tak ada default export skill).
import fs from "node:fs";
import path from "node:path";

export const SKIP_DIR = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", "vendor", "coverage", ".cache", "storage"]);
export const CODE_EXT = new Set([".js",".jsx",".ts",".tsx",".mjs",".cjs",".php",".py",".rb",".go",".java",".cs",".vue",".svelte",".html",".env",".yml",".yaml",".sql",".sh",".json"]);

export function walkFiles(base, { cap = 4000, exts = null } = {}) {
  const out = [];
  const rec = (dir) => {
    if (out.length >= cap) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (out.length >= cap) return;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { if (!SKIP_DIR.has(ent.name)) rec(full); }
      else {
        if (exts && !exts.has(path.extname(ent.name)) && ![...exts].some(e=>ent.name.endsWith(e))) continue;
        out.push(full);
      }
    }
  };
  rec(base);
  return out;
}

export function mask(s) {
  s = String(s);
  if (s.length <= 8) return "****";
  return s.slice(0, 4) + "…" + s.slice(-2);
}
