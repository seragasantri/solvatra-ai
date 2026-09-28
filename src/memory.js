// Memory store persisten sederhana (JSON di disk).
// Inilah yang bikin agent "makin pintar": fakta yang dipelajari disimpan lintas sesi,
// lalu memori paling relevan disuntik kembali ke system prompt tiap giliran.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { config } from "./config.js";

const MEMORY_FILE = path.join(config.dataDir, "memory.json");

const STOPWORDS = new Set([
  "yang","dan","di","ke","dari","untuk","dengan","pada","adalah","itu","ini",
  "the","a","an","of","to","in","is","are","for","and","or","my","saya","aku","kamu",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export class Memory {
  constructor() {
    this.items = [];
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(MEMORY_FILE, "utf8");
      this.items = JSON.parse(raw);
      if (!Array.isArray(this.items)) this.items = [];
    } catch {
      this.items = [];
    }
  }

  _save() {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(this.items, null, 2));
  }

  // Simpan sebuah fakta. Dedup ringan: kalau teksnya identik, jangan ganda.
  remember(text, tags = []) {
    const clean = String(text || "").trim();
    if (!clean) return null;
    const existing = this.items.find((m) => m.text.toLowerCase() === clean.toLowerCase());
    if (existing) {
      existing.hits = (existing.hits || 0) + 1;
      existing.updatedAt = new Date().toISOString();
      this._save();
      return existing;
    }
    const item = {
      id: crypto.randomUUID(),
      text: clean,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString(),
      hits: 0,
    };
    this.items.push(item);
    this._save();
    return item;
  }

  forget(id) {
    const before = this.items.length;
    this.items = this.items.filter((m) => m.id !== id);
    if (this.items.length !== before) this._save();
    return before - this.items.length;
  }

  // Skor relevansi via overlap token (ringan, tanpa embedding).
  search(query, topK = 8) {
    const qTokens = new Set(tokenize(query));
    if (qTokens.size === 0) {
      // Tanpa query: kembalikan yang terbaru + paling sering dipakai.
      return [...this.items]
        .sort((a, b) => (b.hits || 0) - (a.hits || 0) || b.createdAt.localeCompare(a.createdAt))
        .slice(0, topK);
    }
    const scored = this.items.map((m) => {
      const mTokens = tokenize(m.text + " " + (m.tags || []).join(" "));
      let overlap = 0;
      for (const t of mTokens) if (qTokens.has(t)) overlap++;
      const score = overlap + (m.hits || 0) * 0.1;
      return { m, score };
    });
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.m);
  }

  all() {
    return this.items;
  }
}
