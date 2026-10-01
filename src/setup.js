// Setup wizard interaktif di terminal: pilih provider + isi kredensial/model,
// tersimpan ke ~/.ai-agent-traga/config.json. Dipanggil saat provider belum siap.
import { config, setActiveProvider, setProviderField } from "./config.js";
import { listModels } from "./auth.js";
import { select } from "./select.js";

export function providerReady(name = config.provider) {
  const p = config.providers[name];
  if (!p) return false;
  if (name === "solvatra") return !!(p.apiKey && p.model);
  if (name === "claude") return !!(p.apiKey || p.authToken);
  if (name === "codex") return !!p.apiKey;
  if (name === "custom") return !!(p.baseUrl && p.model);
  return false;
}
export function needsSetup() { return !providerReady(config.provider); }

// Input biasa & input rahasia (di-mask dengan *).
function ask(rl, q) { return new Promise((res) => rl.question(q, (a) => res(a.trim()))); }
function askSecret(rl, q) {
  if (!process.stdin.isTTY) return ask(rl, q); // non-interaktif: jangan mask (hindari isu pipe)
  return new Promise((res) => {
    const orig = rl._writeToOutput ? rl._writeToOutput.bind(rl) : null;
    let muted = false;
    rl._writeToOutput = (str) => { if (!orig) return; if (muted) orig(str.includes(q) ? str : "*"); else orig(str); };
    rl.question(q, (a) => { rl._writeToOutput = orig; process.stdout.write("\n"); res(a.trim()); });
    muted = true;
  });
}

export async function runSetup(rl, C, { onlyProvider = null } = {}) {
  const dim = C?.dim || ((s) => s), cyan = C?.cyan || ((s) => s), bold = C?.bold || ((s) => s);
  let provider = onlyProvider;

  if (!provider) {
    console.log("\n" + bold(cyan("  Setup Solvatra")) + dim("  — atur provider & model (tersimpan, tak perlu .env)"));
    const names = ["solvatra", "claude", "codex", "custom"];
    const i = await select(rl, {
      C,
      title: "  Pilih provider:",
      options: [
        { label: "Solvatra AI Gateway", hint: "akun solvatra.web.id (direkomendasikan)" },
        { label: "Claude (Anthropic)", hint: "API key / OAuth token sendiri" },
        { label: "Codex / OpenAI", hint: "API key sendiri" },
        { label: "Custom router", hint: "OpenAI-compatible: OpenRouter, LiteLLM, dll" },
      ],
    });
    provider = names[i] || "solvatra";
  }
  setActiveProvider(provider);

  if (provider === "solvatra") {
    const models = await listModels();
    if (!models.length) {
      console.log(C.yellow("  ⚠ Akun ini belum punya model yang bisa dipakai (cek paket/kuota di solvatra.web.id)."));
    } else {
      const cur = Math.max(0, models.indexOf(config.providers.solvatra.model));
      const i = await select(rl, {
        C,
        title: "  Pilih model (sesuai paket akun):",
        options: models,
        initial: cur,
        hint: "↑/↓ pilih · Enter pakai model ini",
      });
      setProviderField("solvatra", "model", models[i >= 0 ? i : cur]);
    }
  } else if (provider === "claude") {
    const key = await askSecret(rl, C.green("  ANTHROPIC_API_KEY (kosong = pakai OAuth token): "));
    if (key) setProviderField("claude", "apiKey", key);
    else { const tok = await askSecret(rl, C.green("  ANTHROPIC_AUTH_TOKEN: ")); if (tok) setProviderField("claude", "authToken", tok); }
    const model = await ask(rl, C.green(`  model [${config.providers.claude.model}]: `));
    if (model) setProviderField("claude", "model", model);
  } else if (provider === "codex") {
    const key = await askSecret(rl, C.green("  OPENAI_API_KEY: ")); if (key) setProviderField("codex", "apiKey", key);
    const base = await ask(rl, C.green(`  base URL [${config.providers.codex.baseUrl}]: `)); if (base) setProviderField("codex", "baseUrl", base);
    const model = await ask(rl, C.green(`  model [${config.providers.codex.model}]: `)); if (model) setProviderField("codex", "model", model);
  } else {
    const base = await ask(rl, C.green("  base URL (mis. https://openrouter.ai/api/v1): ")); if (base) setProviderField("custom", "baseUrl", base);
    const key = await askSecret(rl, C.green("  API key: ")); if (key) setProviderField("custom", "apiKey", key);
    const model = await ask(rl, C.green("  model (mis. anthropic/claude-3.5-sonnet): ")); if (model) setProviderField("custom", "model", model);
  }

  if (providerReady(provider)) console.log(C.dim(`  ✓ tersimpan ke config.json (provider: ${provider})\n`));
  else console.log(C.yellow(`  ⚠ provider ${provider} belum lengkap — jalankan /setup lagi.\n`));
  return provider;
}
