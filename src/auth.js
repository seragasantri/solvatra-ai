// Login akun Solvatra (solvatra.web.id) — agent hanya bisa dipakai setelah login.
// Alur device code: CLI minta kode -> buka browser -> pemilik akun menyetujui di web
// -> CLI menerima API key tg_live_ miliknya, disimpan di ~/.ai-agent-traga/auth.json (0600).
// Key itu sekaligus dipakai sebagai kredensial provider "solvatra" (gateway /v1).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { TRAGA_HOME, PACKAGE_ROOT, AUTH_FILE, SERVER_URL, readAuthFile } from "./config.js";

export { AUTH_FILE, SERVER_URL };

const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, "package.json"), "utf8")).version; } catch { return "0"; }
})();
// UA eksplisit: Cloudflare di depan solvatra.web.id menolak UA bawaan tertentu (error 1010).
export const USER_AGENT = `solvatra-ai/${VERSION} (+${SERVER_URL})`;

export const loadAuth = readAuthFile;
function saveAuth(a) {
  fs.mkdirSync(TRAGA_HOME, { recursive: true });
  fs.writeFileSync(AUTH_FILE, JSON.stringify(a, null, 2), { mode: 0o600 });
  try { fs.chmodSync(AUTH_FILE, 0o600); } catch {}
}
export function clearAuth() { try { fs.unlinkSync(AUTH_FILE); } catch {} }

async function api(p, { method = "GET", body, key, timeout = 15000 } = {}) {
  const headers = { "User-Agent": USER_AGENT, Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(SERVER_URL + p, {
    method, headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const errMsg = (r) => r.json?.error?.message || `HTTP ${r.status}`;

function openBrowser(url) {
  // Server tanpa layar (SSH) atau sengaja dimatikan: cukup tampilkan URL-nya.
  if (process.env.TRAGA_NO_BROWSER === "1") return false;
  if (process.platform === "linux" && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) return false;
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch { return false; }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Login lewat browser. Mengembalikan data auth tersimpan, atau melempar Error. */
export async function login(C = {}) {
  const dim = C.dim || ((s) => s), cyan = C.cyan || ((s) => s), bold = C.bold || ((s) => s);
  const start = await api("/api/cli/device/start", { method: "POST", body: { client_name: os.hostname().slice(0, 60) } });
  if (start.status !== 201) throw new Error(`Gagal memulai login: ${errMsg(start)}`);
  const d = start.json.data;

  console.log("\n  " + bold("Login ke Solvatra"));
  console.log("  " + dim("Kode perangkat: ") + bold(cyan(d.user_code)));
  const opened = openBrowser(d.verification_uri_complete);
  console.log("  " + dim(opened ? "Browser dibuka. Kalau tidak muncul, buka manual:" : "Buka di browser:"));
  console.log("  " + cyan(d.verification_uri_complete));
  console.log("  " + dim("Pastikan kodenya sama, lalu tekan Setujui. Menunggu persetujuan…"));

  let interval = (d.interval || 5) * 1000;
  const deadline = Date.now() + (d.expires_in || 600) * 1000;
  while (Date.now() < deadline) {
    await sleep(interval);
    let r;
    try { r = await api("/api/cli/device/token", { method: "POST", body: { device_code: d.device_code } }); }
    catch { continue; } // jaringan putus sesaat: coba lagi di putaran berikutnya
    if (r.status === 429) { interval += 5000; continue; }
    if (r.status !== 200) throw new Error(`Login gagal: ${errMsg(r)}`);
    const s = r.json.data;
    if (s.status === "pending") continue;
    if (s.status === "slow_down") { interval += 5000; continue; }
    if (s.status === "denied") throw new Error("Login ditolak di browser.");
    if (s.status === "expired") throw new Error("Kode login kedaluwarsa. Jalankan login lagi.");
    if (s.status === "approved") {
      const auth = { server: SERVER_URL, apiKey: s.api_key, user: s.user, createdAt: new Date().toISOString() };
      saveAuth(auth);
      return auth;
    }
  }
  throw new Error("Waktu login habis (10 menit). Jalankan login lagi.");
}

/**
 * Cek kredensial tersimpan ke server.
 * -> { ok: true, user } | { ok: false, reason: "none" | "invalid" | "network", message }
 */
export async function verify() {
  const a = loadAuth();
  if (!a) return { ok: false, reason: "none" };
  try {
    const r = await api("/api/cli/me", { key: a.apiKey, timeout: 10000 });
    if (r.status === 200) return { ok: true, user: r.json.data.user, apiKey: r.json.data.apiKey };
    if (r.status === 401 || r.status === 403) return { ok: false, reason: "invalid", message: errMsg(r) };
    return { ok: false, reason: "network", message: errMsg(r) };
  } catch (e) {
    return { ok: false, reason: "network", message: e.message };
  }
}

/** Cabut key di server (best-effort) lalu hapus kredensial lokal. */
export async function logout() {
  const a = loadAuth();
  if (a) { try { await api("/api/cli/logout", { method: "POST", body: {}, key: a.apiKey }); } catch {} }
  clearAuth();
  return !!a;
}

/** Daftar model yang boleh dipakai akun ini (slug unified dari /v1/models). */
export async function listModels() {
  const a = loadAuth();
  if (!a) return [];
  try {
    const r = await api("/v1/models", { key: a.apiKey });
    return r.status === 200 ? (r.json.data || []).map((m) => m.id) : [];
  } catch { return []; }
}

/**
 * Model akun ini beserta kesehatannya (stable | unstable | unavailable | unknown) dan rekomendasi.
 * Server lama tanpa /api/cli/models -> jatuh ke /v1/models dengan status "unknown".
 */
export async function listModelHealth() {
  const a = loadAuth();
  if (!a) return [];
  try {
    const r = await api("/api/cli/models", { key: a.apiKey });
    if (r.status === 200 && Array.isArray(r.json?.data)) return r.json.data;
  } catch {}
  return (await listModels()).map((id) => ({ id, name: id, status: "unknown", recommended: false, reason: null }));
}
