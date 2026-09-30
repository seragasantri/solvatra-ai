#!/usr/bin/env node
// CLI chat Solvatra/Solvatra — REPL streaming, memori, skill, multi-provider.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config, activeProvider, setActiveProvider, setProviderField, refresh } from "./config.js";
import { Memory } from "./memory.js";
import { loadSkills } from "./skills.js";
import { Agent } from "./agent.js";
import { extractText, isImage, imageMediaType } from "./extract.js";
import { loadMcpTools } from "./mcp.js";
import { runSetup, needsSetup, providerReady } from "./setup.js";
import { login, logout, verify, clearAuth, listModels, SERVER_URL } from "./auth.js";

// --- Palet warna ANSI (tanpa dependency) ---
const e = (n) => (s) => `\x1b[${n}m${s}\x1b[0m`;
const C = {
  dim: e(2), bold: e(1),
  cyan: e(36), green: e(32), yellow: e(33), red: e(31),
  blue: e(34), magenta: e(35), gray: e(90),
};
const isTTY = !!process.stdout.isTTY;

// --- Spinner braille (hanya di TTY) ---
function makeSpinner() {
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let timer = null, i = 0;
  return {
    start(label) {
      if (!isTTY || timer) return;
      process.stdout.write("\x1b[?25l");
      timer = setInterval(() => {
        process.stdout.write("\r  " + C.cyan(frames[i++ % frames.length]) + " " + C.dim(label) + "   ");
      }, 80);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer); timer = null;
      process.stdout.write("\r\x1b[2K\x1b[?25h");
    },
  };
}

function preflight() {
  const p = activeProvider();
  if (config.provider === "claude" && !p.apiKey && !p.authToken)
    return "Provider claude: set ANTHROPIC_API_KEY atau ANTHROPIC_AUTH_TOKEN (OAuth/SSO resmi).";
  if (config.provider === "codex" && !p.apiKey)
    return "Provider codex: set OPENAI_API_KEY (atau TRAGA_CODEX_API_KEY).";
  if (config.provider === "custom") {
    if (!p.baseUrl) return "Provider custom: set TRAGA_CUSTOM_BASE_URL.";
    if (!p.model) return "Provider custom: set TRAGA_CUSTOM_MODEL.";
  }
  return null;
}

function saveSession(turns) {
  try {
    const dir = path.join(config.dataDir, "sessions");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(file, JSON.stringify(turns, null, 2));
    return file;
  } catch { return null; }
}

function stripAnsi(s) { return s.replace(/\x1b\[[0-9;]*m/g, ""); }
function visLen(s) { return stripAnsi(s).length; }
function drawBox(lines, sepAfter = []) {
  const cols = process.stdout.columns || 80;
  const CW = Math.min(Math.max(...lines.map(visLen), 46), Math.max(40, cols - 6));
  const bar = (l, r) => C.gray(l + "\u2500".repeat(CW + 2) + r);
  const rows = [bar("\u256d", "\u256e")];
  lines.forEach((l, i) => {
    rows.push(C.gray("\u2502 ") + l + " ".repeat(Math.max(0, CW - visLen(l))) + C.gray(" \u2502"));
    if (sepAfter.includes(i)) rows.push(bar("\u251c", "\u2524"));
  });
  rows.push(bar("\u2570", "\u256f"));
  return rows.join("\n");
}
function toolInfo(name, input) {
  input = input || {};
  const arg = input.name || input.command || input.path || input.url || input.query || input.topic || input.action || "";
  const short = String(arg).replace(/\s+/g, " ").slice(0, 48);
  const LABEL = {
    create_skill: "membuat skill baru\u2026",
    run_command: "menjalankan perintah\u2026",
    read_document: "membaca dokumen\u2026",
    read_file: "membaca file\u2026",
    edit_file: "mengubah file\u2026",
    fetch_url: "mengambil halaman web\u2026",
    search_code: "mencari di kode\u2026",
    list_dir: "melihat folder\u2026",
    recall: "mengingat memori\u2026",
    recall_session: "membaca sesi sebelumnya\u2026",
    remember: "menyimpan ke memori\u2026",
    cyber_security: "audit keamanan\u2026",
    system_info: "memeriksa perangkat\u2026",
    frontend: "menyiapkan frontend\u2026",
    frontend_template: "memuat template\u2026",
    write_files: "menulis file\u2026",
  };
  const label = LABEL[name] || (name.endsWith("_guide") ? "mengambil pengetahuan\u2026" : "memproses\u2026");
  const display = short ? `${name} \u00b7 ${short}` : name;
  return { display, label };
}

function modeDot(m) {
  const c = m === "auto" ? C.yellow : m === "manual" ? C.blue : C.green;
  const d = m === "auto" ? "otomatis, tanpa konfirmasi" : m === "manual" ? "read-only, hanya usul" : "konfirmasi tiap aksi berdampak";
  return c("\u25cf") + " " + m + C.dim("   " + d);
}

function modeTag(m) {
  const c = m === "auto" ? C.yellow : m === "manual" ? C.blue : C.green;
  return C.dim("[") + c(m) + C.dim("]");
}
function modeBadge(m) {
  if (m === "auto") return C.yellow("auto") + C.dim("  (aksi berdampak dijalankan tanpa konfirmasi)");
  if (m === "manual") return C.blue("manual") + C.dim("  (read-only; hanya baca & usulkan)");
  return C.green("ask") + C.dim("   (minta konfirmasi tiap aksi berdampak)");
}
function banner(p, agent, skills, memory, mode, mcp) {
  const lbl = (t) => C.dim(t.padEnd(10));
  const lines = [
    C.bold(C.cyan(config.agentName.toUpperCase())) + C.dim("  \u2014  AI agent \u00b7 coding \u00b7 frontend \u00b7 security"),
    lbl("akun") + (account ? account.email : C.dim("-")),
    lbl("provider") + p.label,
    lbl("model") + C.cyan(agent.provider.model),
    lbl("kapasitas") + skills.length + C.dim(" skill") + "   " + memory.all().length + C.dim(" memori") + (mcp ? "   " + mcp + C.dim(" mcp") : ""),
    lbl("mode") + modeDot(mode),
  ];
  console.log("\n" + drawBox(lines, [0]));
  console.log(C.dim("  /help  /setup  /provider  /model  /mode  /attach  /trace  /logout  /exit") + "\n");
}

// --- Login akun Solvatra (wajib sebelum agent bisa dipakai) ---
let account = null;

async function afterLogin() {
  refresh();
  // Provider solvatra tanpa model -> ambil model pertama yang tersedia untuk akun ini.
  if (!config.providers.solvatra.model) {
    const models = await listModels();
    if (models[0]) setProviderField("solvatra", "model", models[0]);
  }
}

async function ensureLogin() {
  let v = await verify();
  if (v.ok) return v.user;
  if (v.reason === "network") {
    console.error(C.yellow(`\n  ⚠  Tidak bisa menghubungi ${SERVER_URL} untuk memeriksa login: ${v.message}\n`));
    return null;
  }
  if (v.reason === "invalid") {
    clearAuth();
    console.log(C.yellow("\n  Login sebelumnya tidak berlaku lagi (key dicabut/kedaluwarsa). Silakan login ulang."));
  } else {
    console.log(C.dim(`\n  ${config.agentName} memerlukan akun Solvatra (${SERVER_URL}). Login dulu — sekali saja per perangkat.`));
  }
  try { await login(C); } catch (e) { console.error(C.yellow(`\n  ⚠  ${e.message}\n`)); return null; }
  await afterLogin();
  v = await verify();
  if (!v.ok) { console.error(C.yellow(`\n  ⚠  Login tersimpan tapi tidak bisa diverifikasi: ${v.message || v.reason}\n`)); return null; }
  console.log(C.green(`  ✓ Login berhasil sebagai ${v.user.email}`));
  return v.user;
}

// Model yang bisa dipilih di /model. solvatra: /v1/models akun (sesuai paket);
// codex/custom: GET <baseUrl>/models (OpenAI-compatible). Gagal -> [] (ketik nama manual).
async function availableModels() {
  if (config.provider === "solvatra") return listModels();
  const pc = config.providers[config.provider];
  if (!pc?.baseUrl) return [];
  try {
    const headers = { Accept: "application/json" };
    if (pc.apiKey) headers.Authorization = `Bearer ${pc.apiKey}`;
    const r = await fetch(pc.baseUrl.replace(/\/+$/, "") + "/models", { headers, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return [];
    const j = await r.json();
    return (j.data || []).map((m) => m.id).filter(Boolean).sort();
  } catch { return []; }
}

// Subperintah non-REPL: solvatra-ai login | logout | whoami
async function subcommand(cmd) {
  if (cmd === "login") {
    try { const a = await login(C); await afterLogin(); console.log(C.green(`\n  ✓ Login berhasil sebagai ${a.user.email}\n`)); return 0; }
    catch (e) { console.error(C.yellow(`\n  ⚠  ${e.message}\n`)); return 1; }
  }
  if (cmd === "logout") {
    const had = await logout();
    console.log(had ? C.dim("\n  Logout: key perangkat ini dicabut & kredensial lokal dihapus.\n") : C.dim("\n  Belum login.\n"));
    return 0;
  }
  if (cmd === "whoami") {
    const v = await verify();
    if (v.ok) { console.log(`\n  ${v.user.name} <${v.user.email}>` + C.dim(`  · ${v.apiKey.masked} · ${SERVER_URL}`) + "\n"); return 0; }
    console.log(C.yellow(`\n  Belum login${v.reason === "network" ? ` (server tidak terjangkau: ${v.message})` : ""}. Jalankan: solvatra-ai login\n`));
    return 1;
  }
  return null;
}

async function main() {
  const memory = new Memory();
  const { tools, dispatch, skills } = await loadSkills();

  // Gerbang akun: tanpa login Solvatra yang valid, agent tidak dijalankan.
  // Sebelum readline dibuat, supaya input yang di-pipe tidak habis selama menunggu jaringan.
  account = await ensureLogin();
  if (!account) process.exit(1);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  // Setup pertama kali: kalau provider belum siap (belum ada kredensial) -> wizard.
  // Kalau sudah dikonfigurasi (atau via env) -> lewati.
  if (needsSetup()) {
    console.log(C.dim("\n  Belum ada provider yang siap. Mari atur dulu (sekali saja):"));
    await runSetup(rl, C);
  }

  // Roadmap: MCP — daftarkan tool dari server MCP terkonfigurasi.
  let mcpCount = 0;
  try {
    const mcp = await loadMcpTools();
    for (const t of mcp.tools) { tools.push(t); skills.push({ name: t.name, description: t.description, run: null }); }
    for (const [k, v] of mcp.dispatch) dispatch.set(k, v);
    mcpCount = mcp.tools.length;
  } catch (e) { /* MCP opsional */ }

  const agent = new Agent({ memory, tools, dispatch, skills });
  let p = activeProvider();
  let mode = config.mode;
  agent.getMode = () => mode;
  const pending = { images: [], notes: [] };
  // Autosave sesi: file stabil per-run, ditulis tiap giliran & saat keluar (anti-kehilangan).
  const sessionFile = path.join(config.dataDir, "sessions", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const persist = () => { try { fs.mkdirSync(path.dirname(sessionFile), { recursive: true }); fs.writeFileSync(sessionFile, JSON.stringify(agent.turns, null, 2)); } catch {} };

  // Giliran yang sedang berjalan; Esc/Ctrl+C membatalkannya tanpa keluar dari aplikasi.
  let busy = null; // AbortController | null

  agent.confirm = (msg) => {
    if (mode === "auto") { process.stdout.write(C.dim(`  ✓ auto-accept: ${String(msg).split("\n")[0]}\n  `)); return Promise.resolve(true); }
    if (mode === "manual") return Promise.resolve(false);
    const signal = busy?.signal;
    return new Promise((res) => {
      // Dibatalkan saat menunggu y/n -> anggap "tidak" & tutup pertanyaannya.
      signal?.addEventListener("abort", () => res(false), { once: true });
      rl.question("\n" + C.yellow("  ⚠  " + msg) + C.dim("\n  Lanjutkan? (y/n) "),
        signal ? { signal } : {}, (a) => res(/^y/i.test(a.trim())));
    });
  };

  banner(p, agent, skills, memory, mode, mcpCount);
  const ask = () => rl.question("\n  " + modeTag(mode) + C.dim("  /mode untuk ganti") + "\n  " + C.green("❯") + " ", handle);

  function cmdHelp() {
    console.log("\n  " + C.bold("Perintah"));
    const row = (c, d) => console.log("  " + C.cyan(c.padEnd(16)) + C.dim(d));
    row("/mode [ask|auto|manual]", "lihat/ganti mode approval");
    row("/setup", "atur ulang provider & model (wizard)");
    row("/provider [nama]", "info / ganti provider (solvatra|claude|codex|custom)");
    row("/whoami", "akun Solvatra yang sedang login");
    row("/logout", "logout akun Solvatra (key dicabut) lalu keluar");
    row("/model [no|nama]", "pilih model dari daftar (solvatra: sesuai paket akun)");
    row("/memory", "lihat semua memori tersimpan");
    row("/forget <id>", "hapus satu memori");
    row("/skills", "daftar skill aktif");
    row("/attach <path>", "lampirkan file/gambar ke pesan berikutnya");
    row("/trace", "lihat metrik/observability giliran terakhir");
    row("/cost", "token yang dipakai sesi ini");
    row("/clear", "bersihkan layar");
    row("/exit", "keluar (sesi disimpan)");
    console.log("\n  " + C.dim("Esc / Ctrl+C saat AI menjawab = batalkan & edit ulang prompt · Ctrl+C 2x = keluar"));
    console.log();
  }

  async function handle(line) {
    const input = (line || "").trim();

    if (input === "/exit" || input === "/quit") {
      persist();
      if (agent.turns.length) console.log(C.dim(`\n  Sesi disimpan: ${sessionFile}`));
      console.log(C.dim("  Sampai jumpa! 👋\n"));
      return rl.close();
    }
    if (input === "/help") { cmdHelp(); return ask(); }
    if (input === "/whoami") {
      const v = await verify();
      if (v.ok) console.log(`\n  ${v.user.name} <${v.user.email}>` + C.dim(`  · ${v.apiKey.masked}`) + "\n");
      else console.log(C.yellow(`\n  ${v.message || v.reason}\n`));
      return ask();
    }
    if (input === "/logout") {
      persist();
      await logout();
      console.log(C.dim("\n  Logout: key perangkat ini dicabut. Jalankan lagi untuk login ulang.\n"));
      return rl.close();
    }
    if (input === "/mode" || input.startsWith("/mode ")) {
      const arg = input.slice(5).trim().toLowerCase();
      if (!arg) {
        console.log("\n  " + C.dim("mode saat ini: ") + modeBadge(mode));
        console.log("  " + C.dim("ganti: ") + C.cyan("/mode ask") + C.dim(" | ") + C.cyan("/mode auto") + C.dim(" | ") + C.cyan("/mode manual") + "\n");
      } else if (config.MODES.includes(arg)) {
        mode = arg; console.log("\n  mode → " + modeBadge(mode) + "\n");
      } else {
        console.log(C.yellow(`\n  mode tidak dikenal: ${arg} (pilih ask|auto|manual)\n`));
      }
      return ask();
    }
    if (input === "/clear") { process.stdout.write("\x1b[2J\x1b[H"); banner(p, agent, skills, memory, mode, mcpCount); return ask(); }
    if (input === "/setup") {
      await runSetup(rl, C);
      agent.rebuildProvider(); p = activeProvider();
      banner(p, agent, skills, memory, mode, mcpCount);
      return ask();
    }
    if (input === "/model" || input.startsWith("/model ")) {
      let name = input.slice(6).trim();
      // Daftar model dari provider — solvatra: sesuai paket akun. Tinggal pilih nomornya.
      const models = await availableModels();
      if (!name && models.length) {
        console.log("\n  " + C.bold(config.provider === "solvatra" ? "Model tersedia untuk paket akun ini" : `Model tersedia di ${p.label}`));
        models.forEach((m, i) => console.log("  " + C.cyan(String(i + 1).padStart(2)) + "  " + (m === agent.provider.model ? C.green(m + "  ● aktif") : m)));
        name = await new Promise((res) => rl.question(C.dim("\n  pilih nomor/nama (Enter = batal): "), (a) => res(a.trim())));
        if (!name) { console.log(); return ask(); }
      }
      if (/^\d+$/.test(name) && models.length) {
        const n = Number(name);
        if (!models[n - 1]) { console.log(C.yellow(`\n  nomor ${n} tidak ada (1-${models.length}).\n`)); return ask(); }
        name = models[n - 1];
      }
      if (!name) console.log(`\n  ${C.dim("model aktif:")} ${C.cyan(agent.provider.model)}  ${C.dim("(ganti: /model <nama>)")}\n`);
      else if (config.provider === "solvatra" && models.length && !models.includes(name)) console.log(C.yellow(`\n  model "${name}" tidak tersedia di paket akun ini.\n`));
      else { setProviderField(config.provider, "model", name); agent.rebuildProvider(); p = activeProvider(); console.log(`\n  model → ${C.cyan(agent.provider.model)}\n`); }
      return ask();
    }
    if (input === "/provider" || input.startsWith("/provider ")) {
      const arg = input.slice(9).trim().toLowerCase();
      if (!arg) {
        console.log(`\n  ${C.dim("provider")}  ${C.cyan(config.provider)} — ${p.label}`);
        console.log(`  ${C.dim("model")}     ${agent.provider.model}`);
        console.log("  " + C.dim("ganti: ") + C.cyan("/provider solvatra|claude|codex|custom") + "\n");
      } else if (["solvatra", "claude", "codex", "custom"].includes(arg)) {
        setActiveProvider(arg);
        if (!providerReady(arg)) { console.log(C.dim(`\n  Provider ${arg} belum lengkap — lanjut setup:`)); await runSetup(rl, C, { onlyProvider: arg }); }
        agent.rebuildProvider(); p = activeProvider();
        console.log("\n  provider → " + C.cyan(arg) + C.dim("  · model: ") + agent.provider.model + "\n");
      } else {
        console.log(C.yellow(`\n  provider tidak dikenal: ${arg} (solvatra|claude|codex|custom)\n`));
      }
      return ask();
    }
    if (input === "/memory") {
      const items = memory.all();
      console.log();
      if (!items.length) console.log(C.dim("  (memori masih kosong)"));
      for (const m of items) console.log("  " + C.gray(m.id.slice(0, 8)) + "  " + m.text);
      console.log();
      return ask();
    }
    if (input.startsWith("/forget ")) {
      const t = memory.all().find((m) => m.id.startsWith(input.slice(8).trim()));
      if (!t) console.log(C.yellow("\n  id tidak ditemukan\n"));
      else { memory.forget(t.id); console.log(C.dim(`\n  dihapus: ${t.text}\n`)); }
      return ask();
    }
    if (input === "/skills") {
      console.log();
      for (const s of skills) console.log("  " + C.cyan(s.name.padEnd(18)) + C.dim(s.description.slice(0, 70)));
      console.log();
      return ask();
    }
    if (input === "/cost") {
      const u = agent.sessionUsage || {};
      console.log("\n  " + C.bold("Token sesi ini"));
      console.log("  " + C.dim("input :") + " " + (u.input_tokens || 0));
      console.log("  " + C.dim("output:") + " " + (u.output_tokens || 0));
      if (u.cache_read_input_tokens) console.log("  " + C.dim("cache :") + " " + u.cache_read_input_tokens + C.dim(" (dibaca dari cache)"));
      console.log(C.dim("  (token dilaporkan provider; biaya tergantung tarif model.)\n"));
      return ask();
    }
    if (input === "/trace") {
      try {
        const dir = config.logsDir;
        const files = fs.readdirSync(dir).filter((f) => f.startsWith("trace-")).sort();
        const last = files[files.length - 1];
        if (!last) { console.log(C.dim("\n  (belum ada trace)\n")); return ask(); }
        const lines = fs.readFileSync(path.join(dir, last), "utf8").trim().split("\n").slice(-10);
        console.log("\n  " + C.bold("Trace terakhir") + C.dim(`  (${last})`));
        for (const l of lines) {
          try {
            const r = JSON.parse(l);
            const t = (r.ts || "").slice(11, 19);
            console.log("  " + C.gray(t) + "  " + C.cyan(r.model || "?") +
              C.dim(`  ${r.ms}ms  tools:[${(r.tools || []).join(",")}]  tok:${r.in_tokens ?? "?"}/${r.out_tokens ?? "?"}${r.cache_read ? " cache:" + r.cache_read : ""}`));
          } catch {}
        }
        console.log();
      } catch (e) { console.log(C.yellow(`\n  gagal baca trace: ${e.message}\n`)); }
      return ask();
    }
    if (input.startsWith("/attach ")) {
      const fp = input.slice(8).trim().replace(/^['"]|['"]$/g, "");
      if (!fs.existsSync(fp)) { console.log(C.yellow(`\n  file tidak ditemukan: ${fp}\n`)); return ask(); }
      try {
        if (isImage(fp)) {
          const buf = fs.readFileSync(fp);
          if (buf.length > 5 * 1024 * 1024) { console.log(C.yellow("\n  gambar > 5MB, terlalu besar.\n")); return ask(); }
          pending.images.push({ media_type: imageMediaType(fp), data: buf.toString("base64") });
          console.log(C.dim(`\n  📎 gambar dilampirkan: ${fp} (dikirim saat pesan berikutnya)\n`));
        } else {
          const r = await extractText(fp);
          if (r.error && !r.text) { console.log(C.yellow(`\n  ${r.error}\n`)); return ask(); }
          pending.notes.push({ name: fp, text: (r.text || "").slice(0, 40000) });
          console.log(C.dim(`\n  📎 dokumen dilampirkan: ${fp} (${r.kind}, ${(r.text||"").length} char)\n`));
        }
      } catch (e) { console.log(C.yellow(`\n  gagal melampirkan: ${e.message}\n`)); }
      return ask();
    }
    if (!input) return ask();

    // --- Giliran chat ---
    let finalInput = input;
    const images = pending.images.slice();
    const notes = pending.notes.slice();
    if (pending.notes.length) {
      finalInput += "\n\n" + pending.notes.map((n) => `[Lampiran: ${n.name}]\n${n.text}`).join("\n\n");
    }
    pending.images = []; pending.notes = [];
    console.log();
    const spin = makeSpinner();
    spin.start("berpikir…");
    let headerShown = false;
    const showHeader = () => {
      if (headerShown) return;
      spin.stop();
      process.stdout.write("  " + C.bold(C.cyan("✦ " + config.agentName)) + "\n\n  ");
      headerShown = true;
    };
    busy = new AbortController();
    const signal = busy.signal;
    try {
      await agent.chat(finalInput, {
        signal,
        onTool: (name, input) => { const ti = toolInfo(name, input); spin.stop(); showHeader(); process.stdout.write("\n" + C.dim("  ⚙ " + ti.display) + "\n  "); spin.start(ti.label); },
        onDelta: (d) => { spin.stop(); showHeader(); process.stdout.write(d.replace(/\n/g, "\n  ")); },
        images,
      });
      spin.stop();
      if (!headerShown) process.stdout.write(C.dim("  (tak ada keluaran)"));
      process.stdout.write("\n");
    } catch (ex) {
      spin.stop();
      const name = ex?.constructor?.name || "Error";
      if (signal.aborted) {
        busy = null;
        // Lampiran yang ikut terkirim dikembalikan juga, supaya bisa dikirim ulang.
        pending.images.push(...images);
        pending.notes.push(...notes);
        console.log(C.yellow("\n\n  ⏹  Dibatalkan.") + C.dim(" Prompt dikembalikan — edit lalu Enter, atau Ctrl+U untuk menghapus."));
        ask();
        rl.write(input);
        return;
      }
      if (name === "AuthenticationError") console.error(C.yellow("\n  ⚠  Autentikasi gagal — cek kredensial provider.\n"));
      else if (config.provider === "solvatra" && /^HTTP 401\b/.test(ex.message)) console.error(C.yellow("\n  ⚠  Key Solvatra ditolak (dicabut/kedaluwarsa). Jalankan /logout lalu login ulang.\n"));
      else if (config.provider === "solvatra" && /^HTTP 429\b/.test(ex.message)) console.error(C.yellow(`\n  ⚠  Batas permintaan akun Solvatra tercapai. ${(ex.message.match(/"message":"([^"]+)"/) || [])[1] || "Coba lagi sebentar lagi."}\n`));
      else console.error(C.yellow(`\n  ⚠  ${name}: ${ex.message}\n`));
    }
    busy = null;
    persist(); // autosave tiap giliran — aman walau terminal ditutup mendadak
    ask();
  }

  // Ctrl+C: batalkan jawaban yang sedang berjalan -> kosongkan baris -> (2x dalam 2 detik) keluar.
  let lastSigint = 0;
  rl.on("SIGINT", () => {
    if (busy) { busy.abort(); return; }
    if (rl.line) { rl.write(null, { ctrl: true, name: "u" }); return; }
    const now = Date.now();
    if (now - lastSigint < 2000) { persist(); return rl.close(); }
    lastSigint = now;
    process.stdout.write(C.dim("\n  (Ctrl+C sekali lagi untuk keluar, atau ketik /exit)"));
    rl.prompt(true);
  });
  // Esc saat AI sedang menjawab = batalkan (seperti Claude Code).
  process.stdin.on("keypress", (_s, key) => {
    if (busy && key?.name === "escape") busy.abort();
  });
  rl.on("close", () => { persist(); process.exit(0); });
  ask();
}

const sub = process.argv[2];
if (["login", "logout", "whoami"].includes(sub)) subcommand(sub).then((code) => process.exit(code ?? 0));
else main();
