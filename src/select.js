// Menu pilihan interaktif di terminal: ↑/↓ untuk pindah, Enter untuk memilih, Esc untuk batal.
// Dipakai untuk konfirmasi aksi, pilih model, dan wizard. Tanpa dependency.
//
// readline tetap hidup selama menu tampil (ia memegang stdin), jadi keluarannya dibisukan
// sementara dan barisnya dikosongkan sesudahnya — tombol panah tidak "bocor" jadi riwayat
// perintah di layar.

const ESC = "\x1b[";

let active = 0;
/** Sedang ada menu tampil? (handler Ctrl+C global memakainya supaya tidak ikut bereaksi) */
export const isSelecting = () => active > 0;

/**
 * @param {import("node:readline").Interface} rl
 * @param {{ title?: string, options: (string|{label:string, hint?:string})[], initial?: number,
 *           hint?: string, signal?: AbortSignal, pageSize?: number, C?: Record<string, Function> }} o
 * @returns {Promise<number>} indeks pilihan, atau -1 bila dibatalkan (Esc / Ctrl+C / abort)
 */
export function select(rl, o) {
  const C = o.C || {};
  const dim = C.dim || ((s) => s), cyan = C.cyan || ((s) => s), bold = C.bold || ((s) => s);
  const opts = o.options.map((x) => (typeof x === "string" ? { label: x } : x));
  const out = process.stdout;

  // Bukan terminal interaktif: pakai pertanyaan nomor biasa.
  if (!process.stdin.isTTY || !out.isTTY) {
    return new Promise((res) => {
      if (o.title) out.write(o.title + "\n");
      opts.forEach((x, i) => out.write(`  ${i + 1}. ${x.label}\n`));
      rl.question("  pilih nomor: ", (a) => {
        const n = Number(String(a).trim());
        res(n >= 1 && n <= opts.length ? n - 1 : -1);
      });
    });
  }

  return new Promise((resolve) => {
    let idx = Math.min(Math.max(o.initial ?? 0, 0), opts.length - 1);
    const page = Math.min(o.pageSize ?? 10, opts.length);
    let top = Math.max(0, Math.min(idx - Math.floor(page / 2), opts.length - page));
    let drawn = 0;

    const origWrite = rl._writeToOutput;
    rl._writeToOutput = () => {}; // bisukan gema readline selama menu tampil

    const render = () => {
      if (idx < top) top = idx;
      if (idx >= top + page) top = idx - page + 1;
      const lines = [];
      if (o.title) lines.push(o.title);
      if (top > 0) lines.push(dim(`    ↑ ${top} lagi`));
      for (let i = top; i < top + page; i++) {
        const x = opts[i];
        const sel = i === idx;
        lines.push((sel ? cyan("  ❯ ") + bold(x.label) : "    " + x.label) + (x.hint ? dim("  " + x.hint) : ""));
      }
      if (top + page < opts.length) lines.push(dim(`    ↓ ${opts.length - top - page} lagi`));
      lines.push(dim("  " + (o.hint || "↑/↓ pilih · Enter konfirmasi · Esc batal")));
      if (drawn) out.write(`${ESC}${drawn}A\r${ESC}J`);
      else out.write(`${ESC}?25l`);
      out.write(lines.join("\n") + "\n");
      drawn = lines.length;
    };

    let closed = false;
    const finish = (value) => {
      if (closed) return;
      closed = true;
      active--;
      process.stdin.off("keypress", onKey);
      o.signal?.removeEventListener("abort", onAbort);
      // tinggalkan satu baris ringkas berisi pilihan akhir
      if (drawn) out.write(`${ESC}${drawn}A\r${ESC}J`);
      if (o.title) out.write(o.title + "\n");
      out.write(value >= 0 ? cyan("  ❯ ") + opts[value].label + "\n" : dim("  (dibatalkan)\n"));
      out.write(`${ESC}?25h`);
      rl._writeToOutput = origWrite;
      rl.line = ""; rl.cursor = 0; // buang ketikan yang sempat masuk buffer readline
      resolve(value);
    };
    const onAbort = () => finish(-1);

    const onKey = (str, key = {}) => {
      if (key.name === "up" || key.name === "k") { idx = (idx - 1 + opts.length) % opts.length; render(); }
      else if (key.name === "down" || key.name === "j" || key.name === "tab") { idx = (idx + 1) % opts.length; render(); }
      else if (key.name === "pageup") { idx = Math.max(0, idx - page); render(); }
      else if (key.name === "pagedown") { idx = Math.min(opts.length - 1, idx + page); render(); }
      else if (key.name === "return" || key.name === "enter") finish(idx);
      else if (key.name === "escape" || (key.ctrl && key.name === "c")) finish(-1);
      else if (str && /^[1-9]$/.test(str) && Number(str) <= opts.length) { idx = Number(str) - 1; render(); finish(idx); }
      else if (o.shortcuts && str && o.shortcuts[str.toLowerCase()] !== undefined) finish(o.shortcuts[str.toLowerCase()]);
    };

    active++;
    if (o.signal?.aborted) return finish(-1);
    o.signal?.addEventListener("abort", onAbort, { once: true });
    process.stdin.on("keypress", onKey);
    render();
  });
}

/**
 * Pilih banyak: ↑/↓ pindah, Spasi centang/lepas, a = semua/tak satu pun, Enter selesai, Esc batal.
 * @returns {Promise<number[]|null>} indeks yang dicentang, atau null bila dibatalkan
 */
export function multiSelect(rl, o) {
  const C = o.C || {};
  const dim = C.dim || ((s) => s), cyan = C.cyan || ((s) => s), green = C.green || ((s) => s);
  const opts = o.options.map((x) => (typeof x === "string" ? { label: x } : x));
  const out = process.stdout;
  const picked = new Set(o.initial || []);

  if (!process.stdin.isTTY || !out.isTTY) {
    return new Promise((res) => {
      if (o.title) out.write(o.title + "\n");
      opts.forEach((x, i) => out.write(`  ${i + 1}. ${x.label}\n`));
      rl.question("  nomor dipisah koma: ", (a) => {
        const nums = String(a).split(/[,\s]+/).map(Number).filter((n) => n >= 1 && n <= opts.length);
        res(nums.length ? [...new Set(nums.map((n) => n - 1))] : null);
      });
    });
  }

  return new Promise((resolve) => {
    let idx = 0, drawn = 0, closed = false;
    const page = Math.min(o.pageSize ?? 12, opts.length);
    let top = 0;
    const origWrite = rl._writeToOutput;
    rl._writeToOutput = () => {};
    const render = () => {
      if (idx < top) top = idx;
      if (idx >= top + page) top = idx - page + 1;
      const lines = [];
      if (o.title) lines.push(o.title);
      if (top > 0) lines.push(dim(`    ↑ ${top} lagi`));
      for (let i = top; i < top + page; i++) {
        const x = opts[i];
        const box = picked.has(i) ? green("◉") : dim("○");
        lines.push((i === idx ? cyan("  ❯ ") : "    ") + box + " " + x.label + (x.hint ? dim("  " + x.hint) : ""));
      }
      if (top + page < opts.length) lines.push(dim(`    ↓ ${opts.length - top - page} lagi`));
      lines.push(dim(`  ↑/↓ pindah · Spasi centang · a semua · Enter selesai (${picked.size} dipilih) · Esc batal`));
      if (drawn) out.write(`${ESC}${drawn}A\r${ESC}J`);
      else out.write(`${ESC}?25l`);
      out.write(lines.join("\n") + "\n");
      drawn = lines.length;
    };
    const finish = (value) => {
      if (closed) return;
      closed = true;
      active--;
      process.stdin.off("keypress", onKey);
      if (drawn) out.write(`${ESC}${drawn}A\r${ESC}J`);
      if (o.title) out.write(o.title + "\n");
      out.write(value ? cyan("  ❯ ") + (value.map((i) => opts[i].label).join(", ") || dim("(tidak ada)")) + "\n" : dim("  (dibatalkan)\n"));
      out.write(`${ESC}?25h`);
      rl._writeToOutput = origWrite;
      rl.line = ""; rl.cursor = 0;
      resolve(value);
    };
    const onKey = (str, key = {}) => {
      if (key.name === "up" || key.name === "k") { idx = (idx - 1 + opts.length) % opts.length; render(); }
      else if (key.name === "down" || key.name === "j" || key.name === "tab") { idx = (idx + 1) % opts.length; render(); }
      else if (key.name === "space") { picked.has(idx) ? picked.delete(idx) : picked.add(idx); render(); }
      else if (str === "a") { if (picked.size === opts.length) picked.clear(); else opts.forEach((_, i) => picked.add(i)); render(); }
      else if (key.name === "return" || key.name === "enter") finish([...picked].sort((x, y) => x - y));
      else if (key.name === "escape" || (key.ctrl && key.name === "c")) finish(null);
    };
    active++;
    process.stdin.on("keypress", onKey);
    render();
  });
}
