// Klien MCP (Model Context Protocol) sederhana lewat HTTP JSON-RPC (Streamable HTTP).
// Membaca daftar server dari ~/.ai-agent-traga/mcp.json:
//   [ { "name": "myserver", "url": "https://host/mcp", "headers": { "Authorization": "Bearer .." } } ]
// Tool tiap server didaftarkan sebagai skill Solvatra bernama mcp__<server>__<tool>.
import fs from "node:fs";
import path from "node:path";
import { config, TRAGA_HOME } from "./config.js";

function readServers() {
  for (const f of [path.join(TRAGA_HOME, "mcp.json"), path.join(config.dataDir, "mcp.json")]) {
    try { const j = JSON.parse(fs.readFileSync(f, "utf8")); if (Array.isArray(j)) return j; if (Array.isArray(j.servers)) return j.servers; } catch {}
  }
  return [];
}

function parseRpcBody(text, ct) {
  if ((ct || "").includes("event-stream")) {
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith("data:")) { try { return JSON.parse(t.slice(5).trim()); } catch {} }
    }
    return null;
  }
  try { return JSON.parse(text); } catch { return null; }
}

async function makeClient(server) {
  let id = 0;
  let sessionId = null;
  const base = () => ({ "Content-Type": "application/json", "Accept": "application/json, text/event-stream", ...(server.headers || {}), ...(sessionId ? { "Mcp-Session-Id": sessionId } : {}) });

  async function rpc(method, params, notify = false) {
    const body = { jsonrpc: "2.0", method, ...(notify ? {} : { id: ++id }), ...(params ? { params } : {}) };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try { res = await fetch(server.url, { method: "POST", headers: base(), body: JSON.stringify(body), signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
    const sid = res.headers.get("mcp-session-id"); if (sid) sessionId = sid;
    if (notify) return null;
    const txt = await res.text();
    const msg = parseRpcBody(txt, res.headers.get("content-type"));
    if (!msg) throw new Error(`respons MCP tak terbaca (HTTP ${res.status})`);
    if (msg.error) throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
    return msg.result;
  }

  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "solvatra-ai", version: "0.1.0" } });
  try { await rpc("notifications/initialized", undefined, true); } catch {}
  const list = await rpc("tools/list", {});
  const tools = (list?.tools) || [];
  return { tools, call: (name, args) => rpc("tools/call", { name, arguments: args || {} }) };
}

// Ubah hasil tools/call MCP jadi string.
function resultToText(r) {
  if (r == null) return "";
  if (typeof r === "string") return r;
  const parts = (r.content || []).map((c) => c.type === "text" ? c.text : c.type === "json" ? JSON.stringify(c.json) : `[${c.type}]`);
  const out = parts.join("\n") || JSON.stringify(r);
  return r.isError ? `MCP tool error: ${out}` : out;
}

// Kembalikan { tools:[toolDef], dispatch:Map } dari semua server MCP terkonfigurasi.
export async function loadMcpTools() {
  const servers = readServers();
  const tools = [];
  const dispatch = new Map();
  for (const srv of servers) {
    if (!srv?.name || !srv?.url) continue;
    try {
      const client = await makeClient(srv);
      for (const t of client.tools) {
        const localName = `mcp__${srv.name}__${t.name}`;
        tools.push({ name: localName, description: `[MCP:${srv.name}] ${t.description || t.name}`, input_schema: t.inputSchema || { type: "object", properties: {} } });
        dispatch.set(localName, async (input) => resultToText(await client.call(t.name, input)));
      }
    } catch (e) {
      console.warn(`[mcp] server "${srv.name}" gagal: ${e.message}`);
    }
  }
  return { tools, dispatch, count: servers.length };
}
