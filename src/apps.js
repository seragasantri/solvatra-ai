// Claude Code & Codex ASLI yang berjalan lewat Solvatra AI.
// Pemakai menempel API key Solvatra (tg_live_…) dan memilih 1–3 model (utama + cadangan).
// Aplikasinya dipasang dari npm resmi; yang diubah hanya alamat server, kunci, dan model.
//
// Dua cara jalan:
//   - perintah khusus `solvatra-claude` / `solvatra-codex` (config terpisah di
//     ~/.ai-agent-traga/apps/…, config Claude Code/Codex milik pemakai tidak disentuh)
//   - bawaan: `claude` / `codex` biasa langsung lewat Solvatra (config lama dicadangkan dulu)
// Model cadangan dikirim lewat header x-solvatra-fallback-models: gateway pindah ke model
// berikutnya bila model utama gagal sebelum sempat menjawab.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { TRAGA_HOME, SERVER_URL } from "./config.js";
import { USER_AGENT } from "./auth.js";
import { select } from "./select.js";
import { pickModel } from "./models.js";

const APPS_FILE = path.join(TRAGA_HOME, "apps.json");
const APPS_DIR = path.join(TRAGA_HOME, "apps");
const IS_WIN = process.platform === "win32";
const FALLBACK_HEADER = "x-solvatra-fallback-models";
const MARK = "solvatra-ai";
const DEFAULT_CONTEXT = 128000; // bila server belum memberi context_window

export const APPS = {
  claude: { name: "Claude Code", bin: "claude", pkg: "@anthropic-ai/claude-code", launcher: "solvatra-claude" },
  codex: { name: "Codex", bin: "codex", pkg: "@openai/codex", launcher: "solvatra-codex" },
};

// ── penyimpanan (0600: berisi API key) ──
function loadApps() { try { return JSON.parse(fs.readFileSync(APPS_FILE, "utf8")); } catch { return {}; } }
function saveApps(a) {
  fs.mkdirSync(TRAGA_HOME, { recursive: true });
  fs.writeFileSync(APPS_FILE, JSON.stringify(a, null, 2), { mode: 0o600 });
  try { fs.chmodSync(APPS_FILE, 0o600); } catch {}
}
function writePrivate(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
}
function backup(file) {
  if (!fs.existsSync(file)) return null;
  const to = `${file}.sebelum-solvatra-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(file, to);
  return to;
}

// ── jaringan ──
async function get(p, key) {
  const r = await fetch(SERVER_URL + p, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });
  let json = null;
  try { json = await r.json(); } catch {}
  return { status: r.status, json };
}
/** Model akun pemilik key, dengan label kesehatan bila server mendukung. */
async function modelsFor(key) {
  const meta = new Map();
  const v1 = await get("/v1/models", key);
  if (v1.status === 401 || v1.status === 403) throw Object.assign(new Error("API key ditolak server (salah, dicabut, atau kedaluwarsa)."), { auth: true });
  if (v1.status !== 200) throw new Error(`Gagal mengambil daftar model (HTTP ${v1.status}).`);
  for (const m of v1.json?.data || []) meta.set(m.id, m);
  let list = null;
  try {
    const h = await get("/api/cli/models", key);
    if (h.status === 200 && Array.isArray(h.json?.data)) list = h.json.data;
  } catch {}
  list ||= [...meta.keys()].map((id) => ({ id, status: "unknown" }));
  return list.map((m) => ({ ...m, contextWindow: meta.get(m.id)?.context_window ?? null }));
}

// ── aplikasi terpasang? ──
function which(bin) {
  const r = spawnSync(IS_WIN ? "where" : "which", [bin], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.split(/\r?\n/)[0].trim() : null;
}
function versionOf(bin) {
  const r = spawnSync(bin, ["--version"], { encoding: "utf8", shell: IS_WIN, timeout: 20000 });
  return r.status === 0 ? (r.stdout || "").trim().split("\n")[0] : null;
}
function npmInstall(pkg) {
  return new Promise((resolve) => {
    const child = spawn("npm", ["install", "-g", pkg], { stdio: "inherit", shell: IS_WIN });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

// ── isi config/env untuk tiap aplikasi ──
const fallbacksOf = (cfg) => cfg.models.slice(1);

/** Variabel lingkungan Claude Code untuk Solvatra. */
function claudeEnv(cfg) {
  const [primary] = cfg.models;
  const env = {
    ANTHROPIC_BASE_URL: SERVER_URL,
    ANTHROPIC_AUTH_TOKEN: cfg.apiKey,
    ANTHROPIC_MODEL: primary,
    ANTHROPIC_DEFAULT_OPUS_MODEL: primary,
    ANTHROPIC_DEFAULT_SONNET_MODEL: primary,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: primary,
    CLAUDE_CODE_SUBAGENT_MODEL: primary,
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
  };
  if (fallbacksOf(cfg).length) env.ANTHROPIC_CUSTOM_HEADERS = `${FALLBACK_HEADER}: ${fallbacksOf(cfg).join(",")}`;
  // model non-Anthropic tidak dikenal Claude Code: beri jendela konteks supaya auto-compact tepat
  env.CLAUDE_CODE_MAX_CONTEXT_TOKENS = String(cfg.contextWindow || DEFAULT_CONTEXT);
  return env;
}
const CLAUDE_ENV_KEYS = [
  "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL", "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC", "ANTHROPIC_CUSTOM_HEADERS",
  "CLAUDE_CODE_MAX_CONTEXT_TOKENS",
];

const tomlStr = (s) => JSON.stringify(String(s)); // string TOML dasar = string JSON untuk teks biasa
/** config.toml Codex. `inlineKey`: kunci ditulis di file (mode bawaan) atau dibaca dari env (mode terpisah). */
function codexToml(cfg, { inlineKey }) {
  const top = [
    `# Dibuat oleh ${MARK}: Codex lewat Solvatra AI (${SERVER_URL}). Ubah lewat: solvatra-ai install`,
    `model = ${tomlStr(cfg.models[0])}`,
    `model_provider = "solvatra"`,
    ...(cfg.contextWindow ? [`model_context_window = ${Number(cfg.contextWindow)}`] : []),
  ];
  const provider = [
    `[model_providers.solvatra]`,
    `name = "Solvatra AI"`,
    `base_url = ${tomlStr(SERVER_URL + "/v1")}`,
    `wire_api = "responses"`,
    inlineKey ? `experimental_bearer_token = ${tomlStr(cfg.apiKey)}` : `env_key = "SOLVATRA_API_KEY"`,
    ...(fallbacksOf(cfg).length ? [`http_headers = { ${tomlStr(FALLBACK_HEADER)} = ${tomlStr(fallbacksOf(cfg).join(","))} }`] : []),
  ];
  return { top, provider };
}

const OWN_KEYS = /^\s*(model|model_provider|model_context_window)\s*=/;
const SAVED = "# sebelum-solvatra: ";

/**
 * Sisipkan setelan Solvatra ke config.toml Codex milik pemakai, tanpa membuang setelan lain.
 * Nilai lama yang tertimpa (model, model_provider, …) disimpan sebagai komentar agar bisa dipulihkan.
 */
function mergeCodexToml(existing, { top, provider }) {
  const out = [], saved = [];
  let inTop = true, skipping = false, ours = false;
  for (const line of existing.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) { inTop = false; skipping = /^\s*\[model_providers\.solvatra\]\s*$/.test(line); }
    if (skipping) continue;
    if (inTop && line.includes(`Dibuat oleh ${MARK}`)) { ours = true; continue; }
    if (inTop && line.startsWith(SAVED)) { saved.push(line); continue; }
    if (inTop && OWN_KEYS.test(line)) { if (!ours) saved.push(SAVED + line.trim()); continue; }
    out.push(line);
  }
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out.at(-1).trim()) out.pop();
  return [...top, ...saved, "", ...out, ...(out.length ? [""] : []), ...provider, ""].join("\n");
}
/** Buang setelan Solvatra dari config.toml dan pulihkan nilai lama pemakai. */
function stripCodexToml(existing) {
  const out = [];
  let inTop = true, skipping = false, ours = false;
  for (const line of existing.split(/\r?\n/)) {
    if (/^\s*\[/.test(line)) { inTop = false; skipping = /^\s*\[model_providers\.solvatra\]\s*$/.test(line); }
    if (skipping) continue;
    if (inTop && line.includes(`Dibuat oleh ${MARK}`)) { ours = true; continue; }
    if (inTop && line.startsWith(SAVED)) { out.push(line.slice(SAVED.length)); continue; }
    if (inTop && OWN_KEYS.test(line) && (ours || /"solvatra"/.test(line))) continue;
    out.push(line);
  }
  return out.join("\n").trim() + "\n";
}

const isolatedHome = (app) => path.join(APPS_DIR, app);
const userClaudeSettings = () => path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "settings.json");
const userCodexConfig = () => path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "config.toml");

/** Tulis config terpisah (selalu) — dipakai `solvatra-claude` / `solvatra-codex`. */
function writeIsolated(app, cfg) {
  const home = isolatedHome(app);
  fs.mkdirSync(home, { recursive: true });
  if (app === "claude") {
    // lewati layar onboarding/login Anthropic: kredensialnya dari env Solvatra
    const state = path.join(home, ".claude.json");
    let j = {};
    try { j = JSON.parse(fs.readFileSync(state, "utf8")); } catch {}
    writePrivate(state, JSON.stringify({ ...j, hasCompletedOnboarding: true }, null, 2));
  } else {
    const t = codexToml(cfg, { inlineKey: false });
    writePrivate(path.join(home, "config.toml"), [...t.top, "", ...t.provider, ""].join("\n"));
  }
}

/** Jadikan `claude`/`codex` biasa lewat Solvatra. -> path cadangan (atau null). */
function writeDefault(app, cfg) {
  if (app === "claude") {
    const file = userClaudeSettings();
    let j = {};
    try { j = JSON.parse(fs.readFileSync(file, "utf8")); } catch {}
    const saved = backup(file);
    const env = { ...(j.env || {}) };
    for (const k of CLAUDE_ENV_KEYS) delete env[k];
    writePrivate(file, JSON.stringify({ ...j, env: { ...env, ...claudeEnv(cfg) } }, null, 2) + "\n");
    // tanpa onboarding Anthropic bila belum pernah dipakai
    const state = path.join(path.dirname(file) === path.join(os.homedir(), ".claude") ? os.homedir() : path.dirname(file), ".claude.json");
    if (!fs.existsSync(state)) writePrivate(state, JSON.stringify({ hasCompletedOnboarding: true }, null, 2));
    return saved;
  }
  const file = userCodexConfig();
  const existing = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  const saved = backup(file);
  writePrivate(file, mergeCodexToml(existing, codexToml(cfg, { inlineKey: true })));
  return saved;
}

/** Kembalikan `claude`/`codex` biasa ke akun aslinya (setelan Solvatra dibuang). */
export function removeDefault(app) {
  if (app === "claude") {
    const file = userClaudeSettings();
    if (!fs.existsSync(file)) return false;
    const j = JSON.parse(fs.readFileSync(file, "utf8"));
    if (j.env?.ANTHROPIC_BASE_URL !== SERVER_URL) return false;
    backup(file);
    for (const k of CLAUDE_ENV_KEYS) delete j.env[k];
    if (!Object.keys(j.env).length) delete j.env;
    writePrivate(file, JSON.stringify(j, null, 2) + "\n");
    return true;
  }
  const file = userCodexConfig();
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, "utf8");
  if (!/\[model_providers\.solvatra\]/.test(text)) return false;
  backup(file);
  writePrivate(file, stripCodexToml(text));
  return true;
}

/** Apakah pemakai sudah punya setelan sendiri (jangan sarankan menimpa)? */
function hasOwnSetup(app) {
  if (app === "claude") {
    try {
      const j = JSON.parse(fs.readFileSync(userClaudeSettings(), "utf8"));
      if (j.env?.ANTHROPIC_BASE_URL && j.env.ANTHROPIC_BASE_URL !== SERVER_URL) return true;
    } catch {}
    try { if (JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8")).oauthAccount) return true; } catch {}
    return false;
  }
  const dir = path.dirname(userCodexConfig());
  if (fs.existsSync(path.join(dir, "auth.json"))) return true;
  try { return /model_provider|^model\s*=/m.test(stripCodexToml(fs.readFileSync(userCodexConfig(), "utf8"))); } catch { return false; }
}

// ── input ──
function ask(rl, q) { return new Promise((res) => rl.question(q, (a) => res(a.trim()))); }
function askSecret(rl, q) {
  if (!process.stdin.isTTY) return ask(rl, q);
  return new Promise((res) => {
    const orig = rl._writeToOutput ? rl._writeToOutput.bind(rl) : null;
    let muted = false;
    rl._writeToOutput = (str) => { if (!orig) return; if (muted) orig(str.includes(q) ? str : "*"); else orig(str); };
    rl.question(q, (a) => { rl._writeToOutput = orig; process.stdout.write("\n"); res(a.trim()); });
    muted = true;
  });
}
const mask = (k) => (k ? `${k.slice(0, 8)}••••${k.slice(-4)}` : "");

/** Pilih model utama (+ hingga 2 cadangan). -> array id, atau null bila batal. */
async function pickModels(rl, C, list, current = []) {
  const primary = await pickModel(rl, { C, current: current[0], title: "Model utama", models: list });
  if (!primary) return null;
  const models = [primary];
  while (models.length < 3) {
    const more = await select(rl, {
      C,
      title: "\n  " + C.bold(models.length === 1 ? "Tambah model cadangan?" : "Tambah satu cadangan lagi?") +
        C.dim("  (dipakai otomatis bila model sebelumnya gagal/sibuk)"),
      options: [
        { label: models.length === 1 ? "Tidak, 1 model saja" : "Tidak, cukup", hint: models.length === 1 ? "bawaan" : "" },
        { label: "Ya, pilih model cadangan" },
      ],
    });
    if (more !== 1) break;
    const rest = list.filter((m) => !models.includes(m.id));
    if (!rest.length) break;
    const fb = await pickModel(rl, { C, current: current[models.length], title: `Model cadangan ${models.length}`, models: rest });
    if (!fb) break;
    models.push(fb);
  }
  return models;
}

/**
 * Wizard pasang + hubungkan Claude Code / Codex ke Solvatra.
 * -> true bila selesai.
 */
export async function setupApp(rl, C, app) {
  const A = APPS[app];
  const apps = loadApps();
  const prev = apps[app] || {};
  console.log("\n  " + C.bold(C.cyan(`${A.name} lewat Solvatra AI`)) + C.dim(`  — aplikasi asli, server & model dari ${SERVER_URL.replace(/^https?:\/\//, "")}`));

  // 1) aplikasi asli
  let ver = which(A.bin) ? versionOf(A.bin) : null;
  if (ver) console.log(C.dim(`  ✓ ${A.name} terpasang (${ver})`));
  else {
    const ok = await select(rl, {
      C, title: `\n  ${A.name} belum terpasang. Pasang sekarang dari npm (${A.pkg})?`,
      options: [{ label: "Ya, pasang sekarang" }, { label: "Lewati", hint: "pasang sendiri nanti" }],
    });
    if (ok === 0) {
      console.log(C.dim(`  $ npm install -g ${A.pkg}`));
      if (await npmInstall(A.pkg)) { ver = versionOf(A.bin); console.log(C.green(`  ✓ ${A.name} terpasang${ver ? ` (${ver})` : ""}`)); }
      else console.log(C.yellow(`  ⚠ Gagal memasang. Coba manual: npm install -g ${A.pkg}` + (IS_WIN ? "" : "  (bila izin ditolak: pakai sudo, atau atur prefix npm ke folder rumah)")));
    }
  }

  // 2) API key Solvatra
  console.log(C.dim(`\n  Butuh API key Solvatra (tg_live_…). Buat di ${SERVER_URL}/api-keys`));
  let apiKey = null, list = null;
  for (let attempt = 0; attempt < 3 && !list; attempt++) {
    const hint = prev.apiKey ? C.dim(` (Enter = pakai ${mask(prev.apiKey)})`) : "";
    const input = await askSecret(rl, C.green("  Tempel API key") + hint + C.green(": "));
    apiKey = input || prev.apiKey || "";
    if (!/^tg_(live|test)_\S{8,}$/.test(apiKey)) { console.log(C.yellow("  ⚠ Format key tidak dikenal — harus diawali tg_live_ atau tg_test_.")); continue; }
    try { list = await modelsFor(apiKey); }
    catch (e) { console.log(C.yellow(`  ⚠ ${e.message}`)); if (!e.auth) return false; }
  }
  if (!list) return false;
  if (!list.length) { console.log(C.yellow(`  ⚠ Akun ini belum punya model aktif. Cek paket di ${SERVER_URL}.`)); return false; }
  console.log(C.dim(`  ✓ Key valid · ${list.length} model tersedia`));

  // 3) model: 1 utama (+ cadangan opsional)
  const models = await pickModels(rl, C, list, prev.models || []);
  if (!models) { console.log(C.dim("  Dibatalkan.")); return false; }
  const contextWindow = list.find((m) => m.id === models[0])?.contextWindow || null;

  // 4) cara menjalankan
  const own = hasOwnSetup(app);
  const choice = await select(rl, {
    C,
    title: `\n  Cara menjalankan ${A.name}:`,
    options: [
      { label: `Perintah \`${A.bin}\` biasa langsung pakai Solvatra`, hint: own ? `menimpa setelan ${A.name} Anda (dicadangkan)` : "disarankan" },
      { label: `Perintah khusus \`${A.launcher}\``, hint: own ? `disarankan — \`${A.bin}\` milik Anda tetap seperti sekarang` : `\`${A.bin}\` tidak diubah` },
    ],
    initial: own ? 1 : 0,
  });
  if (choice < 0) { console.log(C.dim("  Dibatalkan.")); return false; }
  const mode = choice === 0 ? "default" : "launcher";

  const cfg = { apiKey, models, contextWindow, mode, updatedAt: new Date().toISOString() };
  writeIsolated(app, cfg);
  let saved = null;
  if (mode === "default") saved = writeDefault(app, cfg);
  else if (prev.mode === "default") removeDefault(app);
  saveApps({ ...apps, [app]: cfg });

  console.log(C.green(`\n  ✓ ${A.name} terhubung ke Solvatra AI`));
  console.log(C.dim(`    model utama : `) + models[0] + (models.length > 1 ? C.dim(`   cadangan: ${models.slice(1).join(", ")}`) : ""));
  if (saved) console.log(C.dim(`    setelan lama dicadangkan: ${saved}`));
  const run = mode === "default" ? A.bin : A.launcher;
  console.log(C.dim(`    jalankan    : `) + C.bold(run) + C.dim(`   (atau: solvatra-ai ${app})`));
  console.log(C.dim(`    ubah lagi   : solvatra-ai install` + (mode === "default" ? `   · kembalikan: solvatra-ai reset ${app}` : "")) + "\n");
  return true;
}

/** Jalankan aplikasi dengan setelan Solvatra (config terpisah). -> kode keluar. */
export async function launchApp(app, args = []) {
  const A = APPS[app];
  const cfg = loadApps()[app];
  if (!cfg?.apiKey || !cfg.models?.length) {
    console.error(`\n  ${A.name} belum dihubungkan ke Solvatra. Jalankan dulu: solvatra-ai install\n`);
    return 1;
  }
  if (!which(A.bin)) {
    console.error(`\n  ${A.name} belum terpasang. Pasang: npm install -g ${A.pkg}  (atau: solvatra-ai install)\n`);
    return 1;
  }
  writeIsolated(app, cfg); // pastikan config terpisah ada & terbaru
  const env = { ...process.env };
  if (app === "claude") {
    delete env.ANTHROPIC_API_KEY; // kunci Anthropic lain akan menang atas token Solvatra
    Object.assign(env, claudeEnv(cfg), { CLAUDE_CONFIG_DIR: isolatedHome("claude") });
  } else {
    Object.assign(env, { CODEX_HOME: isolatedHome("codex"), SOLVATRA_API_KEY: cfg.apiKey });
  }
  return new Promise((resolve) => {
    const child = spawn(A.bin, args, { stdio: "inherit", env, shell: IS_WIN });
    for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => {}); // biarkan anak yang menangani
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    child.on("error", (e) => { console.error(`  Gagal menjalankan ${A.bin}: ${e.message}`); resolve(1); });
  });
}

/** Ringkasan status untuk menu install. */
export function appStatus(app) {
  const cfg = loadApps()[app];
  return cfg?.models?.length ? `terhubung · ${cfg.models[0]}${cfg.models.length > 1 ? ` +${cfg.models.length - 1} cadangan` : ""}` : null;
}
export const _internal = { mergeCodexToml, stripCodexToml, codexToml };
