// Adapter Telegram Bot API (long polling — tanpa server/webhook, jalan dari laptop pun bisa).
import { inScope } from "./store.js";
import { toTelegramHtml, chunks } from "./brain.js";

const API = (process.env.TRAGA_TELEGRAM_API || "https://api.telegram.org").replace(/\/+$/, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function tgCall(token, method, body, { signal, timeout = 40e3 } = {}) {
  const res = await fetch(`${API}/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeout)]) : AbortSignal.timeout(timeout),
  });
  const j = await res.json().catch(() => ({}));
  if (!j.ok) throw Object.assign(new Error(j.description || `HTTP ${res.status}`), { code: j.error_code });
  return j.result;
}

/** Validasi token → info bot. */
export const getMe = (token) => tgCall(token, "getMe", {}, { timeout: 15e3 });

/** Tunggu pesan pribadi pertama (untuk mendaftarkan pemilik). -> { id, name } */
export async function waitFirstPrivate(token, { signal, timeoutMs = 5 * 60e3 } = {}) {
  let offset = 0;
  // lewati antrean pesan lama
  const old = await tgCall(token, "getUpdates", { timeout: 0, offset: -1 });
  if (old.length) offset = old.at(-1).update_id + 1;
  const end = Date.now() + timeoutMs;
  while (Date.now() < end && !signal?.aborted) {
    const ups = await tgCall(token, "getUpdates", { timeout: 25, offset, allowed_updates: ["message"] }, { signal });
    for (const u of ups) {
      offset = u.update_id + 1;
      const m = u.message;
      if (m?.chat?.type === "private" && m.from && !m.from.is_bot) {
        await tgCall(token, "getUpdates", { timeout: 0, offset }); // tandai terbaca
        return { id: m.from.id, name: [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || m.from.username || String(m.from.id) };
      }
    }
  }
  return null;
}

async function downloadPhoto(token, photo) {
  const best = photo.at(-1);
  const f = await tgCall(token, "getFile", { file_id: best.file_id });
  const res = await fetch(`${API}/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(30e3) });
  if (!res.ok) throw new Error(`unduh foto HTTP ${res.status}`);
  return { media_type: "image/jpeg", data: Buffer.from(await res.arrayBuffer()).toString("base64") };
}

/** Jalankan bot sampai `signal` dibatalkan. */
export async function runTelegram({ settings, brain, log, signal }) {
  const { token } = settings.telegram;
  const me = await getMe(token);
  const owners = new Set((settings.telegram.owners || []).map(String));
  log(`Telegram aktif: @${me.username}`);
  let offset = 0;
  let failures = 0;

  const send = async (chatId, text, replyTo) => {
    for (const part of chunks(text, 3900)) {
      const base = { chat_id: chatId, ...(replyTo ? { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true } } : {}) };
      try { await tgCall(token, "sendMessage", { ...base, text: toTelegramHtml(part), parse_mode: "HTML", link_preview_options: { is_disabled: true } }); }
      catch { await tgCall(token, "sendMessage", { ...base, text: part }); } // HTML ditolak → teks polos
      replyTo = null;
    }
  };

  while (!signal.aborted) {
    let ups;
    try {
      ups = await tgCall(token, "getUpdates", { timeout: 30, offset, allowed_updates: ["message"] }, { signal });
      failures = 0;
    } catch (e) {
      if (signal.aborted) break;
      if (e.code === 401) { log("Telegram: token bot tidak berlaku lagi — atur ulang lewat: solvatra-ai gateway"); return; }
      if (e.code === 409) log("Telegram: bot ini sedang dipakai proses lain (getUpdates bentrok).");
      await sleep(Math.min(30e3, 2000 * ++failures));
      continue;
    }
    for (const u of ups) {
      offset = u.update_id + 1;
      const m = u.message;
      if (!m?.from || m.from.is_bot) continue;
      const isGroup = m.chat.type !== "private";
      const isOwner = owners.has(String(m.from.id));
      let text = m.text ?? m.caption ?? "";
      if (isGroup) {
        // di grup: hanya bila disebut, dibalas, atau diawali /ai
        const mentioned = text.includes(`@${me.username}`);
        const replied = m.reply_to_message?.from?.id === me.id;
        const command = /^\/ai(@\w+)?\b/i.test(text) || /^\/(reset|start|help)(@\w+)?\b/i.test(text);
        if (!mentioned && !replied && !command) continue;
        text = text.replace(new RegExp(`@${me.username}`, "g"), "").replace(/^\/ai(@\w+)?\s*/i, "").replace(/^\/(\w+)@\w+/, "/$1").trim();
      }
      if (!inScope(settings.telegram.scope, { isOwner, isGroup, chatId: m.chat.id })) continue;
      const chatId = m.chat.id;
      const name = [m.from.first_name, m.from.last_name].filter(Boolean).join(" ") || m.from.username;
      (async () => {
        let images;
        if (m.photo?.length) { try { images = [await downloadPhoto(token, m.photo)]; } catch (e) { log(`Telegram: foto gagal diunduh (${e.message})`); } }
        brain.handle(
          { platform: "Telegram", chatKey: `tg:${chatId}`, senderKey: `tg:${m.from.id}`, senderName: name, isOwner, isGroup, text, images },
          {
            reply: (t) => send(chatId, t, isGroup ? m.message_id : null).catch((e) => log(`Telegram: gagal mengirim (${e.message})`)),
            typing: (on) => { if (on) tgCall(token, "sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {}); },
          },
        );
      })();
    }
  }
}
