// Utilitas bersama provider: membuat pemanggilan tool andal untuk model APA PUN.
// - Mode "prompt tools": untuk model/upstream yang tidak mendukung function calling native,
//   daftar tool dijelaskan di system prompt dan panggilan dibaca dari teks <tool_call>{…}</tool_call>.
// - Argumen tool yang rusak/terpotong tidak pernah dijalankan diam-diam sebagai {}.
// - Deteksi "cuma mengumumkan, tidak bertindak" untuk satu kali dorongan otomatis.

export const MAX_STEPS = 60; // batas putaran tool per giliran (anti loop tak berujung)

/** Instruksi sistem tambahan saat tool dijelaskan lewat prompt (bukan parameter `tools`). */
export function promptToolsSystem(tools) {
  const list = tools.map((t) => {
    const props = t.input_schema?.properties || {};
    const req = new Set(t.input_schema?.required || []);
    const args = Object.entries(props)
      .map(([k, v]) => `    - ${k}${req.has(k) ? " (wajib)" : ""}: ${v.type || "any"}${v.enum ? ` [${v.enum.join("|")}]` : ""}${v.description ? ` — ${String(v.description).slice(0, 160)}` : ""}`)
      .join("\n");
    return `- ${t.name}: ${String(t.description || "").slice(0, 300)}\n${args}`;
  }).join("\n");
  return `\n\n## Cara memanggil tool (WAJIB diikuti persis)
Untuk memakai tool, tulis blok berikut di jawabanmu (boleh lebih dari satu), lalu BERHENTI dan tunggu hasilnya:
<tool_call>{"name": "nama_tool", "arguments": {"param": "nilai"}}</tool_call>
Isi blok harus JSON valid (escape \\n dan " di dalam string). Hasil tool akan dikirim kembali sebagai pesan "[Hasil tool …]".
Jangan mengarang hasil tool. Jangan menulis isi file di chat bila diminta membuat file — panggil write_file.

Tool yang tersedia:
${list}`;
}

const TAG_RE = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/g;
const FENCE_RE = /```(?:json|tool_call)?\s*(\{[\s\S]*?\})\s*```/g;

function parseJsonLoose(s) {
  const r = parseToolArgs(s);
  return r.ok ? r.value : undefined;
}

/**
 * Cari panggilan tool dalam bentuk teks (model tanpa function calling native, atau yang
 * "lupa" dan menulisnya di content). Mengembalikan { calls, text } — text tanpa blok tool.
 */
export function parseTextToolCalls(text, toolNames) {
  const names = new Set(toolNames);
  const calls = [];
  const take = (raw) => {
    const j = parseJsonLoose(raw);
    const name = j?.name || j?.tool || j?.function?.name;
    if (!name || !names.has(name)) return false;
    let args = j.arguments ?? j.parameters ?? j.input ?? j.function?.arguments ?? {};
    if (typeof args === "string") args = parseJsonLoose(args) ?? {};
    calls.push({ id: `call_${Math.random().toString(36).slice(2, 10)}`, name, input: args });
    return true;
  };
  let out = String(text || "").replace(TAG_RE, (m, body) => (take(body) ? "" : m));
  if (!calls.length) out = out.replace(FENCE_RE, (m, body) => (take(body) ? "" : m));
  if (!calls.length) {
    const bare = parseBareToolCalls(out, toolNames);
    if (bare.calls.length) return bare;
  }
  return { calls, text: out.trim() };
}

/**
 * Filter streaming untuk mode prompt-tools: teks biasa diteruskan ke layar,
 * isi <tool_call>…</tool_call> disembunyikan (tampil sebagai progres tool, bukan JSON mentah).
 */
export function makeTagFilter(emit) {
  let buf = "", inside = false;
  const OPEN = "<tool_call>", CLOSE = "</tool_call>";
  return {
    push(chunk) {
      buf += chunk;
      for (;;) {
        if (!inside) {
          const i = buf.indexOf(OPEN);
          if (i === -1) {
            // tahan ekor yang mungkin awal tag terpotong
            const keep = Math.min(buf.length, OPEN.length - 1);
            const safe = buf.slice(0, buf.length - keep);
            if (safe) emit(safe);
            buf = buf.slice(buf.length - keep);
            return;
          }
          if (i > 0) emit(buf.slice(0, i));
          buf = buf.slice(i + OPEN.length); inside = true;
        } else {
          const j = buf.indexOf(CLOSE);
          if (j === -1) return;
          buf = buf.slice(j + CLOSE.length); inside = false;
        }
      }
    },
    flush() { if (!inside && buf) emit(buf); buf = ""; },
  };
}

/** Pesan untuk model saat argumen tool rusak/terpotong — tool TIDAK dijalankan. */
export function badArgsMessage(name, truncated, size, error) {
  return truncated
    ? `ERROR: argumen tool "${name}" TERPOTONG karena melebihi batas output model (${size} karakter). Tool TIDAK dijalankan, tidak ada file yang ditulis. ` +
      `Ulangi dengan potongan kecil: write_file mode "create" berisi ±100–150 baris pertama, lalu write_file mode "append" untuk bagian berikutnya sampai selesai.`
    : `ERROR: argumen tool "${name}" bukan JSON valid${error ? ` (${error})` : ""}. Tool TIDAK dijalankan. Panggil ulang dengan argumen JSON yang benar ` +
      `(escape tanda kutip & baris baru di dalam string). Kalau isinya panjang, pecah: write_file mode "create" untuk bagian awal lalu "append".`;
}

/** Model hanya mengumumkan akan bertindak tanpa memanggil tool? (dorong sekali per giliran) */
export function looksLikeUnfinishedAction(text) {
  const t = String(text || "").trim();
  if (!t || t.length > 1500 || /\?\s*$/.test(t)) return false;
  return /\b(saya|aku|kami)\s+(akan|mau|segera|langsung|sekarang|tulis|tuliskan|buat|buatkan|eksekusi|kirim|jalankan|cek|periksa|mulai|lanjut|lanjutkan)\b|\bsekarang\s+(saya|benar-benar|kita)\b|\b(let me|i'll|i will)\s+(now\s+)?(create|write|run|check|make|build)\b/i.test(t);
}

export const NUDGE_TEXT =
  "[sistem agent] Kamu menjelaskan akan melakukan sesuatu tetapi belum memanggil tool apa pun, jadi belum ada yang terjadi. " +
  "Lakukan SEKARANG dengan memanggil tool yang sesuai (mis. write_file untuk membuat file, read_file untuk membaca). Jangan hanya menjelaskan.";

export const EMPTY_TEXT =
  "[sistem agent] Kamu berhenti tanpa jawaban apa pun setelah memanggil tool. Lanjutkan tugasnya sampai selesai " +
  "(panggil tool berikutnya bila masih perlu), lalu beri ringkasan hasil ke user.";

export const CONTINUE_TEXT =
  "[sistem agent] Jawabanmu terpotong di batas panjang output. Lanjutkan PERSIS dari kata terakhir tanpa mengulang. " +
  "Kalau sedang menulis file, pakai write_file bertahap (mode append).";

// Perbaiki JSON "hampir benar" yang lazim dari model: karakter kontrol mentah (baris baru/tab)
// di dalam string, dan escape tak valid seperti \$ \d \' (sering muncul saat menulis kode).
function repairJsonStrings(s) {
  let out = "", inStr = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (!inStr) { if (ch === '"') inStr = true; out += ch; continue; }
    if (ch === "\\") {
      const nx = s[i + 1];
      if (nx !== undefined && '"\\/bfnrtu'.includes(nx)) { out += ch + nx; i++; }
      else out += "\\\\"; // backslash liar -> literal
      continue;
    }
    if (ch === '"') { inStr = false; out += ch; continue; }
    const c = ch.charCodeAt(0);
    if (c < 0x20) out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : ch === "\t" ? "\\t" : "\\u" + c.toString(16).padStart(4, "0");
    else out += ch;
  }
  return out;
}

/** Parse argumen tool dengan toleran. -> { ok, value, repaired } | { ok:false, error } */
export function parseToolArgs(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return { ok: true, value: {} };
  const unfenced = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const a = unfenced.indexOf("{"), b = unfenced.lastIndexOf("}");
  const braces = a >= 0 && b > a ? unfenced.slice(a, b + 1) : "";
  let error = "JSON tidak valid";
  for (const t of [s, repairJsonStrings(s), unfenced, braces, braces && repairJsonStrings(braces)]) {
    if (!t) continue;
    try {
      let v = JSON.parse(t);
      if (typeof v === "string") { try { v = JSON.parse(v); } catch {} } // argumen ter-encode dua kali
      if (v && typeof v === "object" && !Array.isArray(v)) return { ok: true, value: v, repaired: t !== s };
    } catch (e) { if (t === s) error = e.message; }
  }
  return { ok: false, error };
}

/**
 * Pulihkan tool call native yang bentuknya salah, yang sering muncul dari parser upstream:
 * - nama berisi seluruh JSON: name = '{"name":"edit_file","arguments":{…}}'
 * - nama berprefiks: "functions.write_file", "write_file<|tool▁sep|>"
 * - argumen membungkus ulang: {"name":"write_file","arguments":{…}}
 * Mengembalikan call yang sudah dinormalkan (atau apa adanya bila tak bisa dipulihkan).
 */
export function normalizeToolCall(tc, toolNames) {
  const names = toolNames instanceof Set ? toolNames : new Set(toolNames);
  let { name, input } = tc;
  if (!names.has(name)) {
    const raw = String(name || "").trim();
    if (raw.startsWith("{")) {
      const j = parseToolArgs(raw);
      const nm = j.ok && (j.value.name || j.value.function?.name || j.value.tool);
      if (nm && names.has(nm)) {
        let args = j.value.arguments ?? j.value.parameters ?? j.value.input ?? j.value.function?.arguments ?? {};
        if (typeof args === "string") { const a = parseToolArgs(args); args = a.ok ? a.value : {}; }
        return { ...tc, name: nm, input: args, bad: false };
      }
    }
    const hit = [...names].filter((n) => raw.includes(n)).sort((a, b) => b.length - a.length)[0];
    if (hit) name = hit;
  }
  if (input && typeof input === "object" && input.name === name && input.arguments && typeof input.arguments === "object") {
    input = input.arguments;
  }
  return { ...tc, name, input };
}

/** Objek JSON seimbang yang dimulai di posisi `start` (menghormati string). */
function balancedObject(text, start) {
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) { if (esc) esc = false; else if (ch === "\\") esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}

/** JSON polos {"name":"<tool>","arguments":{…}} di tengah teks (tanpa tag/pagar). */
export function parseBareToolCalls(text, toolNames) {
  const names = new Set(toolNames);
  const calls = [];
  let out = String(text || "");
  const re = /\{\s*"(?:name|tool)"\s*:/g;
  let m;
  const spans = [];
  while ((m = re.exec(out))) {
    const obj = balancedObject(out, m.index);
    if (!obj) continue;
    const j = parseToolArgs(obj);
    const nm = j.ok && (j.value.name || j.value.tool);
    if (!nm || !names.has(nm)) continue;
    let args = j.value.arguments ?? j.value.parameters ?? j.value.input ?? {};
    if (typeof args === "string") { const a = parseToolArgs(args); args = a.ok ? a.value : {}; }
    calls.push({ id: `call_${Math.random().toString(36).slice(2, 10)}`, name: nm, input: args });
    spans.push([m.index, m.index + obj.length]);
    re.lastIndex = m.index + obj.length;
  }
  for (const [a, b] of spans.reverse()) out = out.slice(0, a) + out.slice(b);
  return { calls, text: out.trim() };
}
