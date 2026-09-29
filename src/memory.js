// Memory store persisten + VECTOR SEARCH (RAG-lite).
// Embedding lokal: hashed word-unigram + char-trigram -> vektor 256-dim ternormalisasi,
// lalu cosine similarity. Tanpa dependency / API, jalan offline. Keyword dipakai sbg bumbu.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

const MEMORY_FILE = path.join(config.dataDir, "memory.json");
const DIM = 256;

const STOPWORDS = new Set(["yang","dan","di","ke","dari","untuk","dengan","pada","adalah","itu","ini",
  "the","a","an","of","to","in","is","are","for","and","or","my","saya","aku","kamu"]);

function tokenize(text) {
  return String(text || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/).filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// Embedding: hash fitur ke DIM slot, L2-normalize.
export function embed(text) {
  const v = new Float64Array(DIM);
  const add = (s) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    v[(h >>> 0) % DIM] += 1;
  };
  for (const t of tokenize(text)) {
    add("w:" + t);
    for (let i = 0; i + 3 <= t.length; i++) add("c:" + t.slice(i, i + 3));
  }
  let n = 0; for (let i = 0; i < DIM; i++) n += v[i] * v[i];
  n = Math.sqrt(n) || 1;
  return Array.from(v, (x) => x / n);
}
function cosine(a, b) { let s = 0; const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) s += a[i] * b[i]; return s; }

export class Memory {
  constructor() { this.items = []; this._load(); }

  _load() {
    try { this.items = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8")); if (!Array.isArray(this.items)) this.items = []; }
    catch { this.items = []; }
    // Backfill vektor utk item lama.
    let changed = false;
    for (const m of this.items) if (!Array.isArray(m.vec)) { m.vec = embed(m.text + " " + (m.tags || []).join(" ")); changed = true; }
    if (changed) this._save();
  }
  _save() {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.items, null, 2));
  }

  remember(text, tags = []) {
    const clean = String(text || "").trim();
    if (!clean) return null;
    const existing = this.items.find((m) => m.text.toLowerCase() === clean.toLowerCase());
    if (existing) { existing.hits = (existing.hits || 0) + 1; existing.updatedAt = new Date().toISOString(); this._save(); return existing; }
    const item = { id: crypto.randomUUID(), text: clean, tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(), hits: 0, vec: embed(clean + " " + (tags || []).join(" ")) };
    this.items.push(item); this._save(); return item;
  }
  forget(id) { const b = this.items.length; this.items = this.items.filter((m) => m.id !== id); if (this.items.length !== b) this._save(); return b - this.items.length; }

  // Cari relevan: cosine(vektor) + bumbu keyword-overlap + hits.
  search(query, topK = 8) {
    if (!this.items.length) return [];
    const q = String(query || "");
    if (!q.trim()) return [...this.items].sort((a, b) => (b.hits || 0) - (a.hits || 0)).slice(0, topK);
    const qv = embed(q);
    const qTokens = new Set(tokenize(q));
    const scored = this.items.map((m) => {
      const vec = Array.isArray(m.vec) ? m.vec : embed(m.text);
      let overlap = 0;
      for (const t of tokenize(m.text)) if (qTokens.has(t)) overlap++;
      const score = cosine(qv, vec) + 0.05 * overlap + 0.02 * (m.hits || 0);
      return { m, score };
    });
    return scored.filter((s) => s.score > 0.02).sort((a, b) => b.score - a.score).slice(0, topK).map((s) => s.m);
  }
  all() { return this.items; }
}
