#!/usr/bin/env node
// CLI chat Solvatra/Solvatra — REPL streaming, memori, skill, multi-provider.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config, activeProvider } from "./config.js";
import { Memory } from "./memory.js";
import { loadSkills } from "./skills.js";
import { Agent } from "./agent.js";
import { extractText, isImage, imageMediaType } from "./extract.js";
import { loadMcpTools } from "./mcp.js";

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
  const line = C.gray("  " + "─".repeat(46));
  const lbl = (t) => C.dim(t.padEnd(10));
  console.log();
  console.log("  " + C.bold(C.cyan("✦ " + config.agentName)) + C.dim("  ·  siap membantu"));
  console.log(line);
  console.log("  " + lbl("provider") + p.label);
  console.log("  " + lbl("model") + C.cyan(agent.provider.model));
  console.log("  " + lbl("skill") + skills.length + C.dim("   memori ") + memory.all().length + (mcp ? C.dim("   mcp " + mcp) : ""));
  console.log("  " + lbl("mode") + modeBadge(mode) + C.dim("  ·  ganti: /mode"));
  console.log("  " + lbl("perintah") + C.gray("/help /mode /attach /trace /cost /skills /exit"));
  console.log(line + "\n");
}

async function main() {
  const err = preflight();
  if (err) {
    console.error(C.yellow(`\n  ⚠  ${err}\n`) + C.dim("     Lihat .env.example / ~/.ai-agent-traga/.env\n"));
    process.exit(1);
  }

  const memory = new Memory();
  const { tools, dispatch, skills } = await loadSkills();
  // Roadmap: MCP — daftarkan tool dari server MCP terkonfigurasi (~/.ai-agent-traga/mcp.json)
  let mcpCount = 0;
  try {
    const mcp = await loadMcpTools();
    for (const t of mcp.tools) { tools.push(t); skills.push({ name: t.name, description: t.description, run: null }); }
    for (const [k, v] of mcp.dispatch) dispatch.set(k, v);
    mcpCount = mcp.tools.length;
  } catch (e) { /* MCP opsional */ }
  const agent = new Agent({ memory, tools, dispatch, skills });
  const p = activeProvider();
  let mode = config.mode;
  agent.getMode = () => mode;
  const pending = { images: [], notes: [] };

  banner(p, agent, skills, memory, mode, mcpCount);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  agent.confirm = (msg) => {
    if (mode === "auto") { process.stdout.write(C.dim(`  ✓ auto-accept: ${String(msg).split("\n")[0]}\n  `)); return Promise.resolve(true); }
    if (mode === "manual") return Promise.resolve(false); // ditolak; skill juga cek ctx.mode
    return new Promise((res) => rl.question("\n" + C.yellow("  ⚠  " + msg) + C.dim("\n  Lanjutkan? (y/n) "),
      (a) => res(/^y/i.test(a.trim()))));
  };
  const ask = () => rl.question("\n  " + modeTag(mode) + C.dim("  /mode untuk ganti") + "\n  " + C.green("❯") + " ", handle);

  function cmdHelp() {
    console.log("\n  " + C.bold("Perintah"));
    const row = (c, d) => console.log("  " + C.cyan(c.padEnd(16)) + C.dim(d));
    row("/mode [ask|auto|manual]", "lihat/ganti mode approval");
    row("/provider", "info provider & model aktif");
    row("/memory", "lihat semua memori tersimpan");
    row("/forget <id>", "hapus satu memori");
    row("/skills", "daftar skill aktif");
    row("/attach <path>", "lampirkan file/gambar ke pesan berikutnya");
    row("/trace", "lihat metrik/observability giliran terakhir");
    row("/cost", "token yang dipakai sesi ini");
    row("/clear", "bersihkan layar");
    row("/exit", "keluar (sesi disimpan)");
    console.log();
  }

  async function handle(line) {
    const input = (line || "").trim();

    if (input === "/exit" || input === "/quit") {
      const f = saveSession(agent.turns);
      if (f) console.log(C.dim(`\n  Sesi disimpan: ${f}`));
      console.log(C.dim("  Sampai jumpa! 👋\n"));
      return rl.close();
    }
    if (input === "/help") { cmdHelp(); return ask(); }
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
    if (input === "/provider") {
      console.log(`\n  ${C.dim("provider")}  ${C.cyan(config.provider)} — ${p.label}`);
      console.log(`  ${C.dim("model")}     ${agent.provider.model}`);
      console.log(C.dim("  Ganti: TRAGA_PROVIDER=claude|codex|custom lalu jalankan ulang.\n"));
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
    try {
      await agent.chat(finalInput, {
        onTool: (name) => { spin.stop(); showHeader(); process.stdout.write("\n" + C.dim(`  ⚙ ${name}`) + "\n  "); spin.start("memproses…"); },
        onDelta: (d) => { spin.stop(); showHeader(); process.stdout.write(d.replace(/\n/g, "\n  ")); },
        images,
      });
      spin.stop();
      if (!headerShown) process.stdout.write(C.dim("  (tak ada keluaran)"));
      process.stdout.write("\n");
    } catch (ex) {
      spin.stop();
      const name = ex?.constructor?.name || "Error";
      if (name === "AuthenticationError") console.error(C.yellow("\n  ⚠  Autentikasi gagal — cek kredensial provider.\n"));
      else console.error(C.yellow(`\n  ⚠  ${name}: ${ex.message}\n`));
    }
    ask();
  }

  rl.on("close", () => process.exit(0));
  ask();
}

main();
