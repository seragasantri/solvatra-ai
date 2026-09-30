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
  const t = String(s).trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try { return JSON.parse(t); } catch { return undefined; }
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
export function badArgsMessage(name, truncated, size) {
  return truncated
    ? `ERROR: argumen tool "${name}" TERPOTONG karena melebihi batas output model (${size} karakter). Tool TIDAK dijalankan, tidak ada file yang ditulis. ` +
      `Ulangi dengan potongan kecil: write_file mode "create" berisi ±100–150 baris pertama, lalu write_file mode "append" untuk bagian berikutnya sampai selesai.`
    : `ERROR: argumen tool "${name}" bukan JSON valid. Tool TIDAK dijalankan. Panggil ulang dengan argumen JSON yang benar (escape tanda kutip & baris baru di dalam string).`;
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
