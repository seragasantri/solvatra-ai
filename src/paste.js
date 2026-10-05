// Tempel (paste) multi-baris tanpa langsung terkirim — seperti Claude Code.
//
// Terminal biasa mengirim tiap baris tempelan sebagai Enter, sehingga readline mengirim prompt
// di baris pertama. Di sini mode "bracketed paste" dinyalakan: terminal membungkus tempelan
// dengan ESC[200~ … ESC[201~. Tempelan multi-baris (atau sangat panjang) diganti penanda
// "[Teks tempel #1 · 23 baris]" di kotak ketik; isinya dikembalikan utuh saat Enter ditekan.
// Terminal tanpa bracketed paste: potongan input berisi beberapa baris sekaligus dianggap tempelan.

const START = "\x1b[200~";
const END = "\x1b[201~";
const LONG = 800; // tempelan satu baris sepanjang ini juga diringkas
const TAG = /\[Teks tempel #(\d+) · [^\]]+\]/g;

const store = new Map();
let seq = 0;

/** Penanda untuk tempelan; teks pendek satu baris dikembalikan apa adanya. */
function collapse(raw) {
  const text = raw.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  const lines = text.split("\n").length;
  if (lines < 2 && text.length < LONG) return text;
  const id = ++seq;
  store.set(id, text);
  const size = lines > 1 ? `${lines.toLocaleString("id-ID")} baris` : `${text.length.toLocaleString("id-ID")} karakter`;
  return `[Teks tempel #${id} · ${size}]`;
}

/** Kembalikan isi tempelan di dalam baris yang dikirim. */
export function expandPastes(line) {
  return String(line ?? "").replace(TAG, (m, id) => (store.has(Number(id)) ? store.get(Number(id)) : m));
}

/** Panjang awalan `marker` yang menggantung di akhir `s` (penanda bisa terbelah antar-potongan). */
function partial(s, marker) {
  for (let k = Math.min(marker.length - 1, s.length); k > 0; k--) if (s.endsWith(marker.slice(0, k))) return k;
  return 0;
}

let installed = false;

/** Pasang di stdin (sekali). Semua pembaca stdin — readline, menu pilihan — melihat versi yang sudah diringkas. */
export function installPasteGuard(stdin = process.stdin, stdout = process.stdout) {
  if (installed || !stdin.isTTY) return;
  installed = true;
  const emit = stdin.emit.bind(stdin);
  let carry = "", pasting = false, buf = "", flushTimer = null;

  const process_ = (chunk) => {
    let s = carry + chunk, out = "";
    carry = "";
    for (;;) {
      if (!pasting) {
        const i = s.indexOf(START);
        if (i < 0) {
          const k = partial(s, START);
          out += s.slice(0, s.length - k);
          carry = s.slice(s.length - k);
          break;
        }
        out += s.slice(0, i);
        s = s.slice(i + START.length);
        pasting = true; buf = "";
      } else {
        const j = s.indexOf(END);
        if (j < 0) {
          const k = partial(s, END);
          buf += s.slice(0, s.length - k);
          carry = s.slice(s.length - k);
          break;
        }
        buf += s.slice(0, j);
        s = s.slice(j + END.length);
        pasting = false;
        out += collapse(buf);
        buf = "";
      }
    }
    // cadangan tanpa bracketed paste: beberapa baris dalam satu potongan = tempelan
    if (!pasting && /[\r\n][^\r\n]/.test(out) && !out.includes("\x1b")) out = collapse(out);
    return out;
  };

  stdin.emit = (event, ...args) => {
    if (event !== "data") return emit(event, ...args);
    const chunk = Buffer.isBuffer(args[0]) ? args[0].toString("utf8") : String(args[0]);
    clearTimeout(flushTimer);
    const out = process_(chunk);
    // ESC tunggal (batal) tidak boleh tertahan menunggu sisa penanda
    if (carry && !pasting) flushTimer = setTimeout(() => { const c = carry; carry = ""; if (c) emit("data", c); }, 30);
    return out ? emit("data", out) : true;
  };

  stdout.write("\x1b[?2004h");
  process.on("exit", () => { try { stdout.write("\x1b[?2004l"); } catch {} });
}

export const _test = { collapse, partial, store };
