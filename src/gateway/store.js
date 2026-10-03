// Setelan Gateway bot: ~/.ai-agent-traga/gateway/config.json (0600 — berisi token bot).
import fs from "node:fs";
import path from "node:path";
import { TRAGA_HOME } from "../config.js";

export const GATEWAY_DIR = path.join(TRAGA_HOME, "gateway");
export const GATEWAY_FILE = path.join(GATEWAY_DIR, "config.json");
export const WA_AUTH_DIR = path.join(GATEWAY_DIR, "whatsapp-auth");
export const DEPS_DIR = path.join(GATEWAY_DIR, "deps");

/**
 * Bentuk:
 * {
 *   model?, fallbackModels?: [], persona?: string, ownerMode: "ask"|"auto"|"manual",
 *   telegram?: { enabled, token, botName, owners: [userId], scope: { mode: "all"|"private"|"owner"|"list", chats: [{id,name}] } },
 *   whatsapp?: { enabled, owners: ["628…"], scope: { mode: "all"|"private"|"owner"|"groups"|"numbers"|"custom", numbers: [], groups: [{id,name}] } }
 * }
 */
export function loadGateway() {
  try { return JSON.parse(fs.readFileSync(GATEWAY_FILE, "utf8")); } catch { return { ownerMode: "ask" }; }
}
export function saveGateway(g) {
  fs.mkdirSync(GATEWAY_DIR, { recursive: true });
  fs.writeFileSync(GATEWAY_FILE, JSON.stringify(g, null, 2), { mode: 0o600 });
  try { fs.chmodSync(GATEWAY_FILE, 0o600); } catch {}
}
export function updateGateway(fn) { const g = loadGateway(); const n = fn(g) || g; saveGateway(n); return n; }

/** Nomor → format internasional tanpa + (08xx → 628xx). */
export function normalizeNumber(s) {
  let d = String(s).replace(/[^\d]/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  return d.length >= 8 ? d : null;
}

/** Apakah pesan ini masuk cakupan bot? (pemilik selalu masuk) */
export function inScope(scope = { mode: "all" }, { isOwner, isGroup, number, groupId, chatId }) {
  if (isOwner) return true;
  switch (scope.mode) {
    case "owner": return false;
    case "private": return !isGroup;
    case "groups": return isGroup && (scope.groups || []).some((g) => g.id === groupId);
    case "numbers": return !isGroup && (scope.numbers || []).includes(number);
    case "custom":
      return isGroup ? (scope.groups || []).some((g) => g.id === groupId) : (scope.numbers || []).includes(number);
    case "list": return (scope.chats || []).some((c) => String(c.id) === String(chatId));
    default: return true; // all
  }
}

export const SCOPE_LABEL = {
  all: "semua kontak & grup",
  private: "semua chat pribadi (tanpa grup)",
  owner: "hanya pemilik",
  groups: "grup tertentu saja",
  numbers: "nomor tertentu saja",
  custom: "nomor & grup tertentu",
  list: "chat/grup tertentu",
};
export function describeScope(scope = { mode: "all" }) {
  const base = SCOPE_LABEL[scope.mode] || SCOPE_LABEL.all;
  const extra = [];
  if (scope.numbers?.length && ["numbers", "custom"].includes(scope.mode)) extra.push(`${scope.numbers.length} nomor`);
  if (scope.groups?.length && ["groups", "custom"].includes(scope.mode)) extra.push(`${scope.groups.length} grup`);
  if (scope.chats?.length && scope.mode === "list") extra.push(`${scope.chats.length} chat`);
  return base + (extra.length ? ` (${extra.join(", ")})` : "");
}
