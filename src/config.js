// Konfigurasi terpusat, disiapkan untuk instalasi GLOBAL.
// - PACKAGE_ROOT : lokasi kode + skill/template bawaan (read-only saat global).
// - TRAGA_HOME   : ~/.ai-agent-traga — tempat state yang berubah (memori, .env, skill & template buatan user).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = path.resolve(here, "..");
export const PROJECT_ROOT = PACKAGE_ROOT; // alias lama (kompatibilitas)

export const TRAGA_HOME = process.env.TRAGA_HOME || path.join(os.homedir(), ".ai-agent-traga");

// Pastikan folder home + subfolder ada (aman dipanggil berulang).
for (const d of ["", "data", "data/sessions", "logs", "skills", "frontend-template"]) {
  try { fs.mkdirSync(path.join(TRAGA_HOME, d), { recursive: true }); } catch {}
}

// Muat .env: cwd (project yang sedang dikerjakan) -> ~/.traga -> package. Tidak menimpa env yang sudah ada.
(function loadDotenv() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(TRAGA_HOME, ".env"),
    path.join(PACKAGE_ROOT, ".env"),
  ];
  for (const file of candidates) {
    try {
      const raw = fs.readFileSync(file, "utf8");
      for (const line of raw.split("\n")) {
        const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
        if (m && process.env[m[1]] === undefined) {
          process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
        }
      }
    } catch { /* lanjut kandidat berikutnya */ }
  }
})();

// Persona: env TRAGA_PERSONA -> ~/.traga/persona.md -> package/persona.md.
function readPersona() {
  if (process.env.TRAGA_PERSONA) return process.env.TRAGA_PERSONA;
  for (const file of [path.join(TRAGA_HOME, "persona.md"), path.join(PACKAGE_ROOT, "persona.md")]) {
    try { const t = fs.readFileSync(file, "utf8").trim(); if (t) return t; } catch {}
  }
  return null;
}
const persona = readPersona();

// Akun Solvatra: agent wajib login (lihat auth.js). Key hasil login dipakai provider "solvatra".
export const SERVER_URL = (process.env.TRAGA_SERVER_URL || "https://solvatra.web.id").replace(/\/+$/, "");
export const AUTH_FILE = path.join(TRAGA_HOME, "auth.json");
export function readAuthFile() {
  try {
    const a = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    return a?.apiKey && a.server === SERVER_URL ? a : null;
  } catch { return null; }
}

const MODES = ["ask", "auto", "manual"];
export const CONFIG_FILE = path.join(TRAGA_HOME, "config.json");

// Konfigurasi tersimpan dari terminal/wizard (dipakai bila env tidak di-set).
let fileCfg = (() => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { return {}; } })();
export function saveConfigFile() {
  try { fs.mkdirSync(TRAGA_HOME, { recursive: true }); fs.writeFileSync(CONFIG_FILE, JSON.stringify(fileCfg, null, 2)); return true; }
  catch { return false; }
}
const fp = (name, key) => fileCfg?.providers?.[name]?.[key] ?? null;

export const config = {
  agentName: process.env.SOLVATRA_NAME || process.env.TRAGA_NAME || "Solvatra",
  persona,
  maxTokens: Number(process.env.TRAGA_MAX_TOKENS || 8000),
  effort: process.env.TRAGA_EFFORT || "low",
  memoryTopK: Number(process.env.TRAGA_MEMORY_TOPK || 8),
  MODES,

  dataDir: path.join(TRAGA_HOME, "data"),
  logsDir: path.join(TRAGA_HOME, "logs"),

  contextTurns: Number(process.env.TRAGA_CONTEXT_TURNS || 24),
  temperature: process.env.TRAGA_TEMPERATURE !== undefined ? Number(process.env.TRAGA_TEMPERATURE) : null,
  topP: process.env.TRAGA_TOP_P !== undefined ? Number(process.env.TRAGA_TOP_P) : null,
  topK: process.env.TRAGA_TOP_K !== undefined ? Number(process.env.TRAGA_TOP_K) : null,
  frequencyPenalty: process.env.TRAGA_FREQUENCY_PENALTY !== undefined ? Number(process.env.TRAGA_FREQUENCY_PENALTY) : null,
  presencePenalty: process.env.TRAGA_PRESENCE_PENALTY !== undefined ? Number(process.env.TRAGA_PRESENCE_PENALTY) : null,
  promptCache: process.env.TRAGA_PROMPT_CACHE !== "0",

  bundledSkillsDir: path.join(PACKAGE_ROOT, "skills"),
  userSkillsDir: path.join(TRAGA_HOME, "skills"),
  skillsDir: path.join(TRAGA_HOME, "skills"),
  get skillsDirs() { return [this.bundledSkillsDir, this.userSkillsDir]; },

  knowledgeDir: path.join(PACKAGE_ROOT, "knowledge"),
  bundledTemplatesDir: path.join(PACKAGE_ROOT, "frontend-template"),
  userTemplatesDir: path.join(TRAGA_HOME, "frontend-template"),
  templatesDir: path.join(PACKAGE_ROOT, "frontend-template"),
  get templatesDirs() { return [this.bundledTemplatesDir, this.userTemplatesDir]; },

  // diisi oleh refresh()
  provider: "solvatra",
  mode: "ask",
  providers: {},
};

// Hitung ulang provider/mode/providers dari env + config.json (env menang).
export function refresh() {
  fileCfg = (() => { try { return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")); } catch { return fileCfg || {}; } })();
  config.provider = (process.env.TRAGA_PROVIDER || fileCfg.provider || "solvatra").toLowerCase();
  const m = (process.env.SOLVATRA_MODE || fileCfg.mode || "ask").toLowerCase();
  config.mode = MODES.includes(m) ? m : "ask";
  const auth = readAuthFile();
  config.providers = {
    solvatra: {
      label: "Solvatra AI Gateway (akun solvatra.web.id)",
      baseUrl: SERVER_URL + "/v1",
      model: process.env.TRAGA_SOLVATRA_MODEL || fp("solvatra", "model") || null,
      apiKey: auth?.apiKey || null,
      extraHeaders: JSON.stringify({ "User-Agent": `traga-agent (+${SERVER_URL})` }),
    },
    claude: {
      label: "Claude (Anthropic, resmi)",
      model: process.env.TRAGA_MODEL || fp("claude", "model") || "claude-opus-5",
      apiKey: process.env.ANTHROPIC_API_KEY || fp("claude", "apiKey") || null,
      authToken: process.env.ANTHROPIC_AUTH_TOKEN || fp("claude", "authToken") || null,
    },
    codex: {
      label: "Codex / OpenAI (resmi)",
      baseUrl: process.env.TRAGA_CODEX_BASE_URL || fp("codex", "baseUrl") || "https://api.openai.com/v1",
      model: process.env.TRAGA_CODEX_MODEL || fp("codex", "model") || "gpt-4o",
      apiKey: process.env.TRAGA_CODEX_API_KEY || process.env.OPENAI_API_KEY || fp("codex", "apiKey") || null,
    },
    custom: {
      label: "Custom router (OpenAI-compatible)",
      baseUrl: process.env.TRAGA_CUSTOM_BASE_URL || fp("custom", "baseUrl") || null,
      model: process.env.TRAGA_CUSTOM_MODEL || fp("custom", "model") || null,
      apiKey: process.env.TRAGA_CUSTOM_API_KEY || fp("custom", "apiKey") || null,
      extraHeaders: process.env.TRAGA_CUSTOM_HEADERS || fp("custom", "extraHeaders") || null,
    },
  };
}
refresh();

// Setter dari terminal/wizard — tulis ke config.json lalu refresh.
export function setActiveProvider(name) { fileCfg.provider = name; saveConfigFile(); refresh(); }
export function setMode(m) { fileCfg.mode = m; saveConfigFile(); refresh(); }
export function setProviderField(name, key, value) {
  fileCfg.providers = fileCfg.providers || {};
  fileCfg.providers[name] = fileCfg.providers[name] || {};
  fileCfg.providers[name][key] = value;
  saveConfigFile(); refresh();
}

export function activeProvider() {
  const p = config.providers[config.provider];
  if (!p) throw new Error(`Provider "${config.provider}" tidak dikenal. Pilih: solvatra | claude | codex | custom.`);
  return p;
}
