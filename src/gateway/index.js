// `solvatra-ai gateway` — jadikan Solvatra AI asisten bot di Telegram dan/atau WhatsApp.
//   solvatra-ai gateway         menu: jalankan, atur Telegram/WhatsApp, cakupan, akses
//   solvatra-ai gateway start   langsung jalan (untuk pm2/systemd/tmux)
import fs from "node:fs";
import readline from "node:readline";
import { config } from "../config.js";
import { verify } from "../auth.js";
import { select, multiSelect } from "../select.js";
import { pickModel } from "../models.js";
import { loadGateway, saveGateway, updateGateway, normalizeNumber, describeScope, WA_AUTH_DIR, GATEWAY_FILE } from "./store.js";
import { Brain } from "./brain.js";
import { getMe, waitFirstPrivate, runTelegram } from "./telegram.js";

const ask = (rl, q) => new Promise((res) => rl.question(q, (a) => res(a.trim())));
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
const numbersFrom = (s) => [...new Set(String(s).split(/[,;\s]+/).map(normalizeNumber).filter(Boolean))];
const wa = () => import("./whatsapp.js"); // Baileys hanya dimuat bila WhatsApp dipakai

function summary(C, g) {
  const lines = [];
  lines.push(C.dim("  Model      : ") + (g.model || config.providers.solvatra?.model || "-") + (g.fallbackModels?.length ? C.dim(`  cadangan: ${g.fallbackModels.join(", ")}`) : ""));
  lines.push(C.dim("  Telegram   : ") + (g.telegram?.token ? `@${g.telegram.botName} · ${describeScope(g.telegram.scope)} · pemilik ${g.telegram.owners?.length || 0}` + (g.telegram.enabled === false ? C.yellow(" (nonaktif)") : "") : C.dim("belum diatur")));
  lines.push(C.dim("  WhatsApp   : ") + (fs.existsSync(WA_AUTH_DIR) && g.whatsapp ? `+${g.whatsapp.me || "?"} · ${describeScope(g.whatsapp.scope)}` + (g.whatsapp.enabled === false ? C.yellow(" (nonaktif)") : "") : C.dim("belum diatur")));
  lines.push(C.dim("  Akses      : ") + "kontak = chat saja · pemilik = agent penuh" + C.dim(` (konfirmasi: ${g.ownerMode || "ask"})`));
  const pc = g.publicChannel;
  lines.push(C.dim("  Channel    : ") + (pc?.enabled
    ? C.cyan("publik/pemasaran") + C.dim(` · gratis ${pc.freePerDay ?? 10}/orang/hari · daftar: ${pc.registerUrl || "solvatra.web.id/register"}`)
    : C.dim("pribadi")));
  return lines.join("\n");
}

// ── Telegram ──
async function setupTelegram(rl, C) {
  const g = loadGateway();
  console.log(C.dim("\n  1. Buka @BotFather di Telegram → /newbot → ikuti langkahnya → salin token bot."));
  let token = null, me = null;
  for (let i = 0; i < 3 && !me; i++) {
    const hint = g.telegram?.token ? C.dim(" (Enter = token lama)") : "";
    token = (await askSecret(rl, C.green("  Token bot") + hint + C.green(": "))) || g.telegram?.token;
    if (!token) continue;
    try { me = await getMe(token); } catch (e) { console.log(C.yellow(`  ⚠ Token ditolak Telegram: ${e.message}`)); }
  }
  if (!me) return false;
  console.log(C.green(`  ✓ Bot: @${me.username}`));

  // pemilik = akun Telegram yang mengirim pesan pertama ke bot sekarang
  let owners = g.telegram?.owners || [];
  const keep = owners.length ? await select(rl, { C, title: `\n  Pemilik terdaftar: ${owners.length} akun.`, options: ["Pertahankan", "Daftarkan ulang pemilik"] }) : 1;
  if (keep === 1) {
    console.log(C.dim(`\n  2. Dari akun Telegram ANDA, buka t.me/${me.username} dan kirim pesan apa saja (mis. /start). Menunggu… (Esc tidak berlaku; Ctrl+C batal)`));
    const owner = await waitFirstPrivate(token);
    if (!owner) { console.log(C.yellow("  ⚠ Tidak ada pesan masuk dalam 5 menit.")); return false; }
    console.log(C.green(`  ✓ Pemilik: ${owner.name} (id ${owner.id})`));
    owners = [owner.id];
  }

  const modes = ["all", "private", "owner"];
  const s = await select(rl, {
    C, title: "\n  Siapa yang boleh memakai bot ini?",
    options: [
      { label: "Semua orang & grup", hint: "di grup: saat bot disebut/dibalas atau /ai" },
      { label: "Semua chat pribadi (tanpa grup)" },
      { label: "Hanya saya (pemilik)" },
    ],
    initial: Math.max(0, modes.indexOf(g.telegram?.scope?.mode)),
  });
  if (s < 0) return false;
  updateGateway((x) => { x.telegram = { enabled: true, token, botName: me.username, owners, scope: { mode: modes[s] } }; });
  console.log(C.green("  ✓ Telegram tersimpan.") + C.dim(" Di grup, matikan Group Privacy di @BotFather bila ingin bot membaca semua pesan (tidak wajib)."));
  return true;
}

// ── WhatsApp ──
async function setupWhatsApp(rl, C) {
  const W = await wa();
  console.log(C.yellow("\n  Catatan: WhatsApp lewat WhatsApp Web (gratis, tidak resmi). Hindari kirim massal/spam agar nomor aman."));
  if (!W.depsReady()) {
    console.log(C.dim("  Memasang modul WhatsApp (sekali saja, ±60 MB)…"));
    if (!(await W.installDeps())) { console.log(C.yellow("  ⚠ Gagal memasang modul WhatsApp. Cek koneksi/npm lalu coba lagi.")); return false; }
  }
  let pairNumber = null;
  if (!fs.existsSync(WA_AUTH_DIR) || !fs.readdirSync(WA_AUTH_DIR).length) {
    const how = await select(rl, {
      C, title: "\n  Cara menautkan WhatsApp:",
      options: [{ label: "Scan QR", hint: "QR tampil di terminal" }, { label: "Kode tautan", hint: "bila QR sulit discan — masukkan nomor bot" }],
    });
    if (how < 0) return false;
    if (how === 1) pairNumber = normalizeNumber(await ask(rl, C.green("  Nomor WhatsApp yang dipakai bot (08… / 628…): ")));
  }
  let conn;
  try { conn = await W.connectWhatsApp({ log: (s) => console.log(s), pairNumber }); }
  catch (e) { console.log(C.yellow(`  ⚠ ${e.message}`)); return false; }
  const { sock, me } = conn;
  console.log(C.green(`  ✓ WhatsApp tertaut: +${me.number}`));

  const g = loadGateway();
  const prev = g.whatsapp?.scope || {};
  const modes = ["all", "private", "groups", "numbers", "custom", "owner"];
  const s = await select(rl, {
    C, title: "\n  Bot membalas siapa?",
    options: [
      { label: "Semua nomor & grup", hint: "di grup: saat bot di-mention/dibalas atau /ai" },
      { label: "Semua nomor (tanpa grup)" },
      { label: "Grup tertentu saja" },
      { label: "Nomor tertentu saja", hint: "satu atau beberapa nomor" },
      { label: "Nomor & grup tertentu" },
      { label: "Hanya saya (pemilik)" },
    ],
    initial: Math.max(0, modes.indexOf(prev.mode)),
  });
  if (s < 0) { sock.end(undefined); return false; }
  const scope = { mode: modes[s] };

  if (["groups", "custom"].includes(scope.mode)) {
    let groups = [];
    try { groups = await W.listGroups(sock); } catch (e) { console.log(C.yellow(`  ⚠ Gagal mengambil daftar grup: ${e.message}`)); }
    if (!groups.length) console.log(C.yellow("  Nomor ini belum ada di grup mana pun."));
    else {
      const before = new Set((prev.groups || []).map((x) => x.id));
      const idx = await multiSelect(rl, {
        C, title: "\n  Pilih grup:",
        options: groups.map((x) => ({ label: x.name, hint: `${x.size} anggota` })),
        initial: groups.map((x, i) => (before.has(x.id) ? i : -1)).filter((i) => i >= 0),
      });
      if (!idx) { sock.end(undefined); return false; }
      scope.groups = idx.map((i) => ({ id: groups[i].id, name: groups[i].name }));
    }
  }
  if (["numbers", "custom"].includes(scope.mode)) {
    const old = prev.numbers?.length ? C.dim(` (Enter = ${prev.numbers.join(", ")})`) : "";
    const raw = await ask(rl, C.green("  Nomor yang dilayani, pisahkan koma (08…, 628…)") + old + C.green(": "));
    scope.numbers = raw ? numbersFrom(raw) : prev.numbers || [];
    if (!scope.numbers.length) console.log(C.yellow("  ⚠ Belum ada nomor — hanya pemilik yang dilayani sampai nomor ditambahkan."));
  }

  const oldOwners = g.whatsapp?.owners || [];
  const rawOwners = await ask(rl, C.green(`  Nomor pemilik lain (akses agent penuh), pisahkan koma — nomor bot +${me.number} otomatis pemilik`) + (oldOwners.length ? C.dim(` (Enter = ${oldOwners.join(", ")})`) : C.dim(" (Enter = tidak ada)")) + C.green(": "));
  const owners = rawOwners ? numbersFrom(rawOwners) : oldOwners;

  sock.end(undefined);
  updateGateway((x) => { x.whatsapp = { enabled: true, me: me.number, owners, scope }; });
  console.log(C.green(`  ✓ WhatsApp tersimpan · ${describeScope(scope)}`) + C.dim(`\n    Untuk perintah agent dari HP sendiri: kirim pesan ke chat "Anda" (Message yourself) di WhatsApp.`));
  return true;
}

// ── Channel publik (pemasaran) ──
async function setupPublicChannel(rl, C) {
  const g = loadGateway();
  const pc = g.publicChannel || {};
  const DEF_URL = "https://solvatra.web.id/register";
  console.log(C.dim("\n  Mode channel publik menjadikan bot ini kanal pemasaran Solvatra:"));
  console.log(C.dim("  pengunjung dapat persona resmi Solvatra + jatah \"coba gratis\" per hari,"));
  console.log(C.dim("  lalu diajak mendaftar. Pemakaiannya memakai kuota akun Solvatra Anda."));
  const choice = await select(rl, {
    C, title: "",
    options: [
      { label: pc.enabled ? "Nonaktifkan mode publik" : "Aktifkan mode publik" },
      { label: "Atur jatah gratis & link daftar" },
    ],
  });
  if (choice < 0) return;
  if (choice === 0) {
    updateGateway((x) => {
      x.publicChannel = {
        enabled: !pc.enabled,
        freePerDay: pc.freePerDay ?? 10,
        registerUrl: pc.registerUrl || DEF_URL,
      };
    });
    console.log(C.green(`  ✓ Channel publik ${!pc.enabled ? "aktif" : "nonaktif"}.`) + (!pc.enabled ? C.dim(" Tip: set cakupan bot ke \"semua\" agar siapa pun bisa mencoba.") : ""));
    return;
  }
  const capRaw = await ask(rl, C.green("  Jatah coba gratis per orang/hari") + C.dim(` (Enter = ${pc.freePerDay ?? 10}; 0 = tanpa batas): `));
  const urlRaw = await ask(rl, C.green("  Link pendaftaran") + C.dim(` (Enter = ${pc.registerUrl || DEF_URL}): `));
  const cap = capRaw === "" ? (pc.freePerDay ?? 10) : Math.max(0, parseInt(capRaw, 10) || 0);
  updateGateway((x) => {
    x.publicChannel = { enabled: pc.enabled ?? true, freePerDay: cap, registerUrl: urlRaw || pc.registerUrl || DEF_URL };
  });
  console.log(C.green("  ✓ Channel publik tersimpan."));
}

async function setupModel(rl, C) {
  const g = loadGateway();
  const primary = await pickModel(rl, { C, current: g.model || config.providers.solvatra?.model, title: "Model untuk bot" });
  if (!primary) return;
  const fbs = [];
  while (fbs.length < 2) {
    const more = await select(rl, { C, title: `\n  ${fbs.length ? "Tambah satu cadangan lagi?" : "Tambah model cadangan?"}`, options: [fbs.length ? "Tidak, cukup" : "Tidak, 1 model saja", "Ya"] });
    if (more !== 1) break;
    const fb = await pickModel(rl, { C, title: `Model cadangan ${fbs.length + 1}` });
    if (!fb || fb === primary || fbs.includes(fb)) break;
    fbs.push(fb);
  }
  updateGateway((x) => { x.model = primary; x.fallbackModels = fbs; });
}

async function setupAccess(rl, C) {
  const g = loadGateway();
  const persona = await ask(rl, C.green("  Peran bot untuk kontak (mis. \"CS Toko Batik Sari, jam buka 08–17\")") + (g.persona ? C.dim(` (Enter = tetap)`) : "") + C.green(": "));
  const modes = ["ask", "auto", "manual"];
  const m = await select(rl, {
    C, title: "\n  Aksi berdampak dari pemilik (tulis file, jalankan perintah):",
    options: [{ label: "Tanya dulu lewat chat", hint: "balas ya/tidak — disarankan" }, { label: "Langsung kerjakan", hint: "auto" }, { label: "Tolak semua", hint: "agent hanya membaca" }],
    initial: Math.max(0, modes.indexOf(g.ownerMode)),
  });
  updateGateway((x) => { if (persona) x.persona = persona; if (m >= 0) x.ownerMode = modes[m]; });
}

/** Jalankan semua platform aktif sampai Ctrl+C. */
export async function startGateway(C) {
  const v = await verify();
  if (!v.ok) { console.error(C.yellow("\n  Gateway butuh login Solvatra. Jalankan: solvatra-ai login\n")); return 1; }
  config.provider = "solvatra"; // agent pemilik selalu lewat Solvatra
  const g = loadGateway();
  if (!g.model && !config.providers.solvatra?.model) { console.error(C.yellow("\n  Belum ada model. Atur lewat: solvatra-ai gateway\n")); return 1; }
  const tg = g.telegram?.token && g.telegram.enabled !== false;
  const w = g.whatsapp && g.whatsapp.enabled !== false && fs.existsSync(WA_AUTH_DIR);
  if (!tg && !w) { console.error(C.yellow("\n  Belum ada Telegram/WhatsApp yang diatur. Jalankan: solvatra-ai gateway\n")); return 1; }

  const stamp = () => new Date().toLocaleTimeString("id-ID", { hour12: false });
  const log = (s) => console.log(C.dim(`  [${stamp()}] `) + s);
  console.log("\n  " + C.bold(C.cyan("Solvatra AI Gateway")) + C.dim(`  · ${v.user.email}`));
  console.log(summary(C, g));
  console.log(C.dim("  Ctrl+C untuk berhenti.\n"));

  const brain = new Brain({ log });
  const ctrl = new AbortController();
  process.on("SIGINT", () => { if (!ctrl.signal.aborted) { log("berhenti…"); ctrl.abort(); setTimeout(() => process.exit(0), 3000).unref(); } });
  process.on("SIGTERM", () => ctrl.abort());
  const jobs = [];
  if (tg) jobs.push(runTelegram({ settings: g, brain, log, signal: ctrl.signal }).catch((e) => log(C.yellow(`Telegram berhenti: ${e.message}`))));
  if (w) jobs.push(wa().then((W) => W.runWhatsApp({ settings: g, brain, log, signal: ctrl.signal })).catch((e) => log(C.yellow(`WhatsApp berhenti: ${e.message}`))));
  await Promise.all(jobs);
  return 0;
}

/** Menu utama `solvatra-ai gateway`. */
export async function gatewayMenu(C, args = []) {
  if (args[0] === "start" || args[0] === "run") return startGateway(C);
  if (!process.stdin.isTTY) return startGateway(C);
  const v = await verify();
  if (!v.ok) { console.error(C.yellow("\n  Gateway butuh login Solvatra. Jalankan: solvatra-ai login\n")); return 1; }
  for (;;) {
    const g = loadGateway();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    console.log("\n  " + C.bold(C.cyan("Gateway bot")) + C.dim("  — Solvatra AI sebagai asisten di Telegram & WhatsApp"));
    console.log(summary(C, g));
    const ready = (g.telegram?.token) || (g.whatsapp && fs.existsSync(WA_AUTH_DIR));
    const items = [
      { key: "start", label: "Jalankan gateway", hint: ready ? "" : "atur Telegram/WhatsApp dulu" },
      { key: "tg", label: "Atur Telegram bot" },
      { key: "wa", label: "Atur WhatsApp (scan QR)" },
      { key: "model", label: "Pilih model bot" },
      { key: "access", label: "Peran bot & persetujuan pemilik" },
      { key: "public", label: g.publicChannel?.enabled ? "Channel publik (pemasaran) — aktif" : "Channel publik (pemasaran)", hint: "coba gratis → ajak daftar" },
      ...(g.telegram?.token ? [{ key: "tgoff", label: g.telegram.enabled === false ? "Aktifkan Telegram" : "Nonaktifkan Telegram" }] : []),
      ...(g.whatsapp ? [{ key: "waout", label: "Putuskan WhatsApp", hint: "keluar dari perangkat tertaut" }] : []),
      { key: "exit", label: "Keluar" },
    ];
    const i = await select(rl, { C, title: "", options: items });
    const key = items[i]?.key || "exit";
    try {
      if (key === "tg") await setupTelegram(rl, C);
      else if (key === "wa") await setupWhatsApp(rl, C);
      else if (key === "model") await setupModel(rl, C);
      else if (key === "access") await setupAccess(rl, C);
      else if (key === "public") await setupPublicChannel(rl, C);
      else if (key === "tgoff") updateGateway((x) => { x.telegram.enabled = x.telegram.enabled === false; });
      else if (key === "waout") {
        const ok = await select(rl, { C, title: "  Putuskan WhatsApp dari Solvatra?", options: ["Tidak", "Ya, putuskan"] });
        if (ok === 1) { await (await wa()).logoutWhatsApp(); updateGateway((x) => { delete x.whatsapp; }); console.log(C.green("  ✓ WhatsApp diputuskan.")); }
      }
    } catch (e) { console.log(C.yellow(`  ⚠ ${e.message}`)); }
    rl.close();
    if (key === "exit") return 0;
    if (key === "start") return startGateway(C);
  }
}

export { GATEWAY_FILE, saveGateway };
