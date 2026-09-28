#!/usr/bin/env node
// CLI chat untuk Traga. REPL dengan streaming, memori persisten, skill, multi-provider.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { config, activeProvider } from "./config.js";
import { Memory } from "./memory.js";
import { loadSkills } from "./skills.js";
import { Agent } from "./agent.js";


const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

// Cek kredensial sesuai provider aktif. Kembalikan pesan error atau null bila OK.
function preflight() {
  const p = activeProvider();
  if (config.provider === "claude") {
    if (!p.apiKey && !p.authToken) {
      return "Provider claude: set ANTHROPIC_API_KEY (API key) atau ANTHROPIC_AUTH_TOKEN (OAuth/SSO resmi).";
    }
  } else if (config.provider === "codex") {
    if (!p.apiKey) return "Provider codex: set OPENAI_API_KEY (atau TRAGA_CODEX_API_KEY) — API key/OAuth bearer resmi.";
  } else if (config.provider === "custom") {
    if (!p.baseUrl) return "Provider custom: set TRAGA_CUSTOM_BASE_URL (endpoint OpenAI-compatible).";
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

async function main() {
  const err = preflight();
  if (err) {
    console.error(C.yellow(`\n⚠  ${err}\n`) + C.dim("   Lihat .env.example untuk semua opsi.\n"));
    process.exit(1);
  }

  const memory = new Memory();
  const { tools, dispatch, skills } = await loadSkills();
  const agent = new Agent({ memory, tools, dispatch, skills });
  const p = activeProvider();

  console.log(C.bold(C.cyan(`\n  ${config.agentName}`)) + C.dim(` · ${p.label}`));
  console.log(C.dim(`  model: ${agent.provider.model} · ${skills.length} skill · ${memory.all().length} memori`));
  console.log(C.dim("  Perintah: /help  /provider  /memory  /forget <id>  /skills  /exit\n"));

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const prompt = () => rl.question(C.green("kamu › "), handle);

  async function handle(line) {
    const input = line.trim();

    if (input === "/exit" || input === "/quit") {
      const f = saveSession(agent.turns);
      if (f) console.log(C.dim(`\nSesi disimpan: ${f}`));
      console.log(C.dim("Sampai jumpa! 👋"));
      return rl.close();
    }
    if (input === "/help") {
      console.log("\n" +
        "  /provider      info provider & model aktif\n" +
        "  /memory        lihat semua memori tersimpan\n" +
        "  /forget <id>   hapus satu memori\n" +
        "  /skills        daftar skill aktif\n" +
        "  /exit          keluar (sesi disimpan)\n");
      return prompt();
    }
    if (input === "/provider") {
      console.log(`\n  provider: ${C.cyan(config.provider)} — ${p.label}\n  model: ${agent.provider.model}`);
      console.log(C.dim("  Ganti dgn env TRAGA_PROVIDER=claude|codex|custom lalu jalankan ulang.\n"));
      return prompt();
    }
    if (input === "/memory") {
      const items = memory.all();
      if (!items.length) console.log(C.dim("  (memori masih kosong)"));
      for (const m of items) console.log(`  ${C.dim(m.id.slice(0, 8))}  ${m.text}`);
      console.log();
      return prompt();
    }
    if (input.startsWith("/forget ")) {
      const target = memory.all().find((m) => m.id.startsWith(input.slice(8).trim()));
      if (!target) console.log(C.yellow("  id tidak ditemukan"));
      else { memory.forget(target.id); console.log(C.dim(`  dihapus: ${target.text}`)); }
      return prompt();
    }
    if (input === "/skills") {
      for (const s of skills) console.log(`  ${C.cyan(s.name)} — ${s.description}`);
      console.log();
      return prompt();
    }
    if (!input) return prompt();

    process.stdout.write(C.cyan(`\n${config.agentName} › `));
    try {
      await agent.chat(input, { onDelta: (d) => process.stdout.write(d) });
      process.stdout.write("\n\n");
    } catch (e) {
      const name = e?.constructor?.name || "Error";
      if (name === "AuthenticationError") console.error(C.yellow("\n\n⚠  Autentikasi gagal — cek kredensial provider.\n"));
      else console.error(C.yellow(`\n\n⚠  ${name}: ${e.message}\n`));
    }
    prompt();
  }

  prompt();
}

main();
