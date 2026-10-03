// Adapter WhatsApp lewat WhatsApp Web (scan QR / kode tautan) memakai Baileys.
// Gratis, tanpa WhatsApp Business API. Catatan: ini klien tidak resmi — WhatsApp bisa
// membatasi nomor yang dipakai untuk spam/broadcast massal. Pakai sewajarnya.
//
// Baileys (~60 MB) TIDAK ikut terpasang bersama solvatra-ai; dipasang sekali ke
// ~/.ai-agent-traga/gateway/deps saat WhatsApp pertama kali diatur.
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { DEPS_DIR, WA_AUTH_DIR, inScope, normalizeNumber } from "./store.js";
import { toWhatsApp, chunks } from "./brain.js";

const DEPS = { baileys: "7.0.0-rc14", "qrcode-terminal": "0.12.0", pino: "9.14.0" };
const IS_WIN = process.platform === "win32";

export const depsReady = () => fs.existsSync(path.join(DEPS_DIR, "node_modules", "baileys", "package.json"));

export function installDeps() {
  fs.mkdirSync(DEPS_DIR, { recursive: true });
  const pkg = path.join(DEPS_DIR, "package.json");
  if (!fs.existsSync(pkg)) fs.writeFileSync(pkg, JSON.stringify({ name: "solvatra-gateway-deps", private: true }, null, 2));
  const args = ["install", "--no-audit", "--no-fund", "--loglevel=error", ...Object.entries(DEPS).map(([n, v]) => `${n}@${v}`)];
  return new Promise((resolve) => {
    const child = spawn("npm", args, { cwd: DEPS_DIR, stdio: "inherit", shell: IS_WIN });
    child.on("exit", (code) => resolve(code === 0));
    child.on("error", () => resolve(false));
  });
}

async function loadLibs() {
  const require = createRequire(path.join(DEPS_DIR, "package.json"));
  const B = await import(pathToFileURL(require.resolve("baileys")).href);
  return { B, qrcode: require("qrcode-terminal"), pino: require("pino") };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const numberOf = (jid) => (jid && /@s\.whatsapp\.net$/.test(jid) ? normalizeNumber(jid.split("@")[0].split(":")[0]) : null);

/**
 * Sambungkan WhatsApp. Pertama kali: tampilkan QR (atau kode tautan bila `pairNumber` diisi).
 * -> { sock, B, me: { number, lid, name } }  — sock siap dipakai.
 */
export async function connectWhatsApp({ log = console.log, pairNumber = null, signal } = {}) {
  const { B, qrcode, pino } = await loadLibs();
  const makeWASocket = B.default?.default || B.default || B.makeWASocket;
  fs.mkdirSync(WA_AUTH_DIR, { recursive: true });

  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) throw new Error("dibatalkan");
    const { state, saveCreds } = await B.useMultiFileAuthState(WA_AUTH_DIR);
    let version;
    try { version = (await B.fetchLatestBaileysVersion()).version; } catch {}
    const sock = makeWASocket({
      auth: state, logger: pino({ level: "silent" }), browser: B.Browsers.macOS("Solvatra AI"),
      markOnlineOnConnect: false, syncFullHistory: false, ...(version ? { version } : {}),
    });
    sock.ev.on("creds.update", saveCreds);
    let paired = false;
    const result = await new Promise((resolve) => {
      sock.ev.on("connection.update", async (u) => {
        if (u.qr && !pairNumber) {
          log("\n  Scan QR ini dari WhatsApp di HP: Setelan › Perangkat tertaut › Tautkan perangkat\n");
          qrcode.generate(u.qr, { small: true });
        }
        if (u.qr && pairNumber && !paired) {
          paired = true;
          try {
            const code = await sock.requestPairingCode(pairNumber);
            log(`\n  Kode tautan: ${code.slice(0, 4)}-${code.slice(4)}\n  Di HP: WhatsApp › Perangkat tertaut › Tautkan perangkat › Tautkan dengan nomor telepon, lalu masukkan kode di atas.\n`);
          } catch (e) { log(`  Gagal meminta kode tautan: ${e.message}`); }
        }
        if (u.connection === "open") resolve({ ok: true });
        if (u.connection === "close") {
          const code = u.lastDisconnect?.error?.output?.statusCode;
          resolve({ ok: false, code, loggedOut: code === B.DisconnectReason.loggedOut });
        }
      });
    });
    if (result.ok) {
      const me = { number: numberOf(B.jidNormalizedUser(sock.user.id)), lid: sock.user.lid ? B.jidNormalizedUser(sock.user.lid) : null, name: sock.user.name || "" };
      return { sock, B, me };
    }
    try { sock.end(undefined); } catch {}
    if (result.loggedOut) {
      fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
      throw new Error("Perangkat ditautkan ulang/dikeluarkan dari WhatsApp. Atur WhatsApp lagi untuk scan QR baru.");
    }
    // 515 = restart wajib sesudah pairing; lainnya: putus sementara
    if (attempt > 8) throw new Error(`Koneksi WhatsApp gagal berulang (kode ${result.code ?? "?"})`);
    await sleep(result.code === 515 ? 500 : Math.min(30e3, 2000 * (attempt + 1)));
  }
}

/** Daftar grup yang diikuti nomor ini. -> [{ id, name, size }] */
export async function listGroups(sock) {
  const all = await sock.groupFetchAllParticipating();
  return Object.values(all).map((g) => ({ id: g.id, name: g.subject || g.id, size: g.participants?.length || 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function logoutWhatsApp() {
  if (depsReady() && fs.existsSync(WA_AUTH_DIR)) {
    try { const { sock } = await connectWhatsApp({ log: () => {} }); await sock.logout(); } catch {}
  }
  fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true });
}

function textOf(B, m) {
  const c = B.normalizeMessageContent(m.message) || {};
  return {
    content: c,
    text: c.conversation || c.extendedTextMessage?.text || c.imageMessage?.caption || c.videoMessage?.caption || c.documentMessage?.caption || "",
    context: c.extendedTextMessage?.contextInfo || c.imageMessage?.contextInfo || null,
  };
}

/** Jalankan bot sampai `signal` dibatalkan; sambung ulang otomatis bila koneksi putus. */
export async function runWhatsApp({ settings, brain, log, signal }) {
  const wa = settings.whatsapp;
  while (!signal.aborted) {
    const { sock, B, me } = await connectWhatsApp({ log, signal });
    const owners = new Set([me.number, ...(wa.owners || [])].filter(Boolean));
    const selfIds = new Set([me.number && `${me.number}@s.whatsapp.net`, me.lid].filter(Boolean));
    const sentIds = new Set(); // pesan yang dikirim bot sendiri (jangan dibalas)
    log(`WhatsApp aktif: +${me.number}${me.name ? ` (${me.name})` : ""}`);

    const closed = new Promise((resolve) => {
      sock.ev.on("connection.update", (u) => { if (u.connection === "close") resolve(u.lastDisconnect?.error?.output?.statusCode); });
      signal.addEventListener("abort", () => { try { sock.end(undefined); } catch {} resolve("stop"); }, { once: true });
    });

    sock.ev.on("messages.upsert", makeUpsertHandler({ sock, B, me, wa, brain, log, owners, selfIds, sentIds }));

    const why = await closed;
    if (why === "stop" || signal.aborted) return;
    if (why === B.DisconnectReason.loggedOut) { fs.rmSync(WA_AUTH_DIR, { recursive: true, force: true }); log("WhatsApp: perangkat dikeluarkan dari HP — atur ulang: solvatra-ai gateway"); return; }
    log(`WhatsApp: koneksi putus (${why ?? "?"}), menyambung ulang…`);
    await sleep(2000);
  }
}

/** Penangan messages.upsert (dipisah agar bisa diuji tanpa koneksi WhatsApp). */
export function makeUpsertHandler({ sock, B, me, wa, brain, log, owners, selfIds, sentIds }) {
  const send = async (jid, text, quoted) => {
    for (const part of chunks(toWhatsApp(text), 3500)) {
      const sent = await sock.sendMessage(jid, { text: part }, quoted ? { quoted } : {});
      if (sent?.key?.id) sentIds.add(sent.key.id);
      quoted = null;
    }
  };

  return async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const m of messages) {
      try {
        const jid = m.key.remoteJid;
        if (!jid || jid === "status@broadcast" || jid.endsWith("@newsletter") || jid.endsWith("@broadcast")) continue;
        if (sentIds.has(m.key.id)) { sentIds.delete(m.key.id); continue; }
        const isGroup = jid.endsWith("@g.us");
        const chatSelf = selfIds.has(B.jidNormalizedUser(jid)) || selfIds.has(B.jidNormalizedUser(m.key.remoteJidAlt || ""));
        // pesan yang saya ketik sendiri ke orang lain bukan perintah untuk bot
        if (m.key.fromMe && !chatSelf) continue;
        const senderJid = isGroup ? (m.key.participantAlt?.endsWith("@s.whatsapp.net") ? m.key.participantAlt : m.key.participant) : (m.key.remoteJidAlt?.endsWith("@s.whatsapp.net") ? m.key.remoteJidAlt : jid);
        const number = m.key.fromMe ? me.number : numberOf(senderJid) || numberOf(m.key.participant) || numberOf(jid);
        const isOwner = m.key.fromMe ? chatSelf : owners.has(number);
        let { content, text, context } = textOf(B, m);
        if (isGroup) {
          const mentioned = (context?.mentionedJid || []).some((j) => selfIds.has(B.jidNormalizedUser(j)));
          const replied = context?.participant && selfIds.has(B.jidNormalizedUser(context.participant));
          const command = /^\/(ai|reset|start|help)\b/i.test(text);
          if (!mentioned && !replied && !command) continue;
          text = text.replace(/@\d+/g, "").replace(/^\/ai\s*/i, "").trim();
        }
        if (!inScope(wa.scope, { isOwner, isGroup, number, groupId: jid })) continue;
        let images;
        if (content.imageMessage) {
          try {
            const buf = await B.downloadMediaMessage(m, "buffer", {}, { logger: undefined, reuploadRequest: sock.updateMediaMessage });
            images = [{ media_type: content.imageMessage.mimetype || "image/jpeg", data: buf.toString("base64") }];
          } catch (e) { log(`WhatsApp: gambar gagal diunduh (${e.message})`); }
        }
        if (!text && !images) continue;
        await sock.readMessages([m.key]).catch(() => {});
        brain.handle(
          { platform: "WhatsApp", chatKey: `wa:${jid}`, senderKey: `wa:${number || senderJid}`, senderName: m.pushName || (number ? `+${number}` : ""), isOwner, isGroup, text, images },
          {
            reply: (t) => send(jid, t, isGroup ? m : null).catch((e) => log(`WhatsApp: gagal mengirim (${e.message})`)),
            typing: (on) => { sock.sendPresenceUpdate(on ? "composing" : "paused", jid).catch(() => {}); },
          },
        );
      } catch (e) { log(`WhatsApp: pesan dilewati (${e.message})`); }
    }
  };
}
