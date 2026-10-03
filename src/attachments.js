// Lampiran untuk CLI: file apa pun (gambar, PDF, DOCX, XLSX, PPTX, CSV, kode/teks) lewat
// /attach, pemilih file sistem, Ctrl+V (gambar/file dari clipboard), dan seret-lepas file ke
// terminal (path yang ditempel otomatis jadi lampiran).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { extractText, isImage, imageMediaType } from "./extract.js";

const MAX_IMAGE_BYTES = 3_500_000;   // di atas ini dikecilkan (batas aman request vision)
const MAX_TEXT = 60_000;
const CONVERT_EXT = new Set([".heic", ".heif", ".tif", ".tiff", ".avif"]);
// File yang otomatis dilampirkan bila path-nya ditempel/diseret ke terminal.
// Kode/teks TIDAK otomatis dilampirkan — agent membacanya sendiri dengan read_file.
const AUTO_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".heic", ".heif", ".tif", ".tiff", ".avif",
  ".pdf", ".docx", ".xlsx", ".xls", ".xlsm", ".ods", ".pptx", ".odt", ".odp", ".csv"]);

const isMac = process.platform === "darwin", isWin = process.platform === "win32";
const tmpFile = (ext) => path.join(os.tmpdir(), `solvatra-${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`);
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { encoding: "utf8", timeout: 20000, ...opts });
const has = (cmd) => run(isWin ? "where" : "which", [cmd]).status === 0;
const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`);

/** Gambar jadi JPEG/PNG yang bisa dibaca model; dikecilkan bila terlalu besar (macOS: sips). */
function normalizeImage(file) {
  const ext = path.extname(file).toLowerCase();
  let src = file, note = "";
  if (CONVERT_EXT.has(ext)) {
    if (!isMac) throw new Error(`format ${ext} belum bisa dikonversi di ${process.platform} — simpan sebagai JPG/PNG`);
    const out = tmpFile(".jpg");
    if (run("sips", ["-s", "format", "jpeg", file, "--out", out]).status !== 0) throw new Error(`gagal mengonversi ${ext} ke JPEG`);
    src = out; note = ` (dikonversi dari ${ext.slice(1).toUpperCase()})`;
  }
  let size = fs.statSync(src).size;
  if (size > MAX_IMAGE_BYTES) {
    if (!isMac) throw new Error(`gambar ${kb(size)} terlalu besar (maks ${kb(MAX_IMAGE_BYTES)}) — kecilkan dulu`);
    // kecilkan bertahap sampai di bawah batas (foto biasa sudah cukup di langkah pertama)
    const original = size;
    let out = null;
    for (const side of ["2000", "1600", "1200", "900"]) {
      out = tmpFile(".jpg");
      if (run("sips", ["-Z", side, "-s", "format", "jpeg", "-s", "formatOptions", "75", src, "--out", out]).status !== 0) throw new Error("gagal mengecilkan gambar");
      if (fs.statSync(out).size <= MAX_IMAGE_BYTES) break;
    }
    note += ` (dikecilkan dari ${kb(original)})`;
    src = out; size = fs.statSync(src).size;
    if (size > MAX_IMAGE_BYTES) throw new Error(`gambar tetap terlalu besar setelah dikecilkan (${kb(size)})`);
  }
  const mt = imageMediaType(src) || (/\.jpe?g$/i.test(src) ? "image/jpeg" : "image/png");
  return { media_type: mt, data: fs.readFileSync(src).toString("base64"), size, note };
}

/** Satu file → lampiran { kind:"image", name, media_type, data } | { kind:"doc", name, text }. */
export async function attachFile(file, label) {
  const p = path.resolve(file.replace(/^~(?=\/|$)/, os.homedir()));
  if (!fs.existsSync(p)) throw new Error(`file tidak ditemukan: ${file}`);
  const st = fs.statSync(p);
  if (st.isDirectory()) throw new Error(`${file} adalah folder — sebut file di dalamnya, atau minta agent membacanya`);
  if (st.size > 50 * 1024 * 1024) throw new Error(`${path.basename(p)} terlalu besar (${kb(st.size)}, maks 50 MB)`);
  const name = label || path.basename(p);
  const ext = path.extname(p).toLowerCase();
  if (isImage(p) || CONVERT_EXT.has(ext)) {
    const img = normalizeImage(p);
    return { kind: "image", name, path: p, media_type: img.media_type, data: img.data, summary: `gambar ${kb(img.size)}${img.note}` };
  }
  const r = await extractText(p);
  if (r.error && !r.text) throw new Error(`${name}: ${r.error}`);
  const text = r.text || "";
  if (!text.trim()) throw new Error(`${name}: tidak ada teks yang bisa dibaca (hasil scan? kirim sebagai gambar)`);
  const clipped = text.length > MAX_TEXT ? text.slice(0, MAX_TEXT) + `\n…[dipotong — total ${text.length} karakter; minta agent membaca bagian lain dengan read_document]` : text;
  return { kind: "doc", name, path: p, text: clipped, summary: `${r.kind}${r.pages ? `, ${r.pages} hlm` : ""}${r.sheets ? `, ${r.sheets} sheet` : ""}, ${text.length.toLocaleString("id-ID")} karakter` };
}

/** Isi clipboard → daftar path file (file yang di-copy, atau gambar yang disimpan sementara). */
export function clipboardFiles() {
  if (isMac) {
    // file yang di-copy di Finder (bisa banyak) — dibaca lewat NSPasteboard (AppleScript «class furl»
    // hanya memberi satu file dan gagal untuk sebagian salinan Finder)
    const jxa = "ObjC.import('AppKit');var u=$.NSPasteboard.generalPasteboard.readObjectsForClassesOptions($([$.NSURL]),$({NSPasteboardURLReadingFileURLsOnlyKey:true}));" +
      "var o=[];if(u)for(var i=0;i<u.count;i++)o.push(u.objectAtIndex(i).path.js);o.join('\\n')";
    const f = run("osascript", ["-l", "JavaScript", "-e", jxa]);
    const files = (f.stdout || "").split("\n").map((s) => s.trim()).filter((s) => s && fs.existsSync(s));
    if (files.length) return { files };
    // gambar (screenshot Cmd+Ctrl+Shift+4, copy image dari browser, dll.)
    const out = tmpFile(".png");
    const img = run("osascript", ["-e", `set f to (open for access POSIX file "${out}" with write permission)`, "-e", "try",
      "-e", "write (the clipboard as «class PNGf») to f", "-e", "end try", "-e", "close access f"]);
    if (img.status === 0 && fs.existsSync(out) && fs.statSync(out).size > 0) return { files: [out], temp: true };
    try { fs.unlinkSync(out); } catch {}
    return { files: [], reason: "clipboard tidak berisi gambar atau file (teks biasa: tempel dengan Cmd+V)" };
  }
  if (isWin) {
    const out = tmpFile(".png");
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $f = [Windows.Forms.Clipboard]::GetFileDropList(); if ($f.Count -gt 0) { $f | ForEach-Object { $_ } ; exit 0 }; $i = [Windows.Forms.Clipboard]::GetImage(); if ($i) { $i.Save('${out}', [Drawing.Imaging.ImageFormat]::Png); Write-Output '${out}' }`;
    const r = run("powershell", ["-NoProfile", "-STA", "-Command", ps]);
    const files = (r.stdout || "").split(/\r?\n/).map((s) => s.trim()).filter((s) => s && fs.existsSync(s));
    return files.length ? { files, temp: files[0] === out } : { files: [], reason: "clipboard tidak berisi gambar atau file" };
  }
  // Linux: Wayland (wl-paste) atau X11 (xclip)
  const out = tmpFile(".png");
  const tool = has("wl-paste") ? ["wl-paste", ["--type", "image/png"]] : has("xclip") ? ["xclip", ["-selection", "clipboard", "-t", "image/png", "-o"]] : null;
  if (!tool) return { files: [], reason: "pasang wl-clipboard (Wayland) atau xclip (X11) untuk paste gambar" };
  const r = spawnSync(tool[0], tool[1], { timeout: 10000 });
  if (r.status === 0 && r.stdout?.length) { fs.writeFileSync(out, r.stdout); return { files: [out], temp: true }; }
  const uri = has("xclip") ? run("xclip", ["-selection", "clipboard", "-t", "text/uri-list", "-o"]).stdout : run("wl-paste", ["--type", "text/uri-list"]).stdout;
  const files = String(uri || "").split(/\r?\n/).filter((s) => s.startsWith("file://")).map((s) => decodeURIComponent(s.slice(7))).filter((s) => fs.existsSync(s));
  return files.length ? { files } : { files: [], reason: "clipboard tidak berisi gambar atau file" };
}

/** Jendela pilih file bawaan sistem (bisa banyak). -> daftar path, [] bila batal. */
export function pickFiles() {
  if (isMac) {
    const r = run("osascript", ["-e", 'set out to ""', "-e", "try",
      "-e", 'repeat with f in (choose file with prompt "Pilih file untuk dilampirkan ke Solvatra AI" with multiple selections allowed)',
      "-e", "set out to out & POSIX path of f & linefeed", "-e", "end repeat", "-e", "end try", "-e", "return out"], { timeout: 600000 });
    return (r.stdout || "").split("\n").map((s) => s.trim()).filter(Boolean);
  }
  if (isWin) {
    const ps = "Add-Type -AssemblyName System.Windows.Forms; $d = New-Object Windows.Forms.OpenFileDialog; $d.Multiselect = $true; $d.Title = 'Pilih file untuk Solvatra AI'; if ($d.ShowDialog() -eq 'OK') { $d.FileNames }";
    return (run("powershell", ["-NoProfile", "-STA", "-Command", ps], { timeout: 600000 }).stdout || "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (has("zenity")) return (run("zenity", ["--file-selection", "--multiple", "--separator=\n"], { timeout: 600000 }).stdout || "").split("\n").filter(Boolean);
  if (has("kdialog")) return (run("kdialog", ["--getopenfilename", "--multiple", "--separate-output"], { timeout: 600000 }).stdout || "").split("\n").filter(Boolean);
  return null; // tidak ada pemilih file grafis
}

/** Pecah argumen path: mendukung "kutip", 'kutip', spasi ber-escape (\ ), dan file:// URL. */
export function splitPaths(s) {
  const out = [];
  const re = /"([^"]+)"|'([^']+)'|((?:\\.|[^\s"'])+)/g;
  let m;
  while ((m = re.exec(s))) {
    let p = m[1] ?? m[2] ?? m[3].replace(/\\(.)/g, "$1");
    if (p.startsWith("file://")) p = decodeURIComponent(p.slice(7));
    out.push(p);
  }
  return out;
}

/**
 * Cari path file yang ditempel/diseret ke dalam pesan (gambar & dokumen saja).
 * -> { paths: [...], text: pesan dengan path diganti nama file }
 */
export function droppedPaths(input) {
  const paths = [];
  const re = /"((?:~|\/|[A-Za-z]:\\)[^"]+)"|'((?:~|\/|[A-Za-z]:\\)[^']+)'|((?:~\/|\/|[A-Za-z]:\\|file:\/\/)(?:\\.|[^\s"'])+)/g;
  const text = input.replace(re, (whole, q1, q2, bare) => {
    let p = q1 ?? q2 ?? bare.replace(/\\(.)/g, "$1");
    if (p.startsWith("file://")) p = decodeURIComponent(p.slice(7));
    const abs = p.replace(/^~(?=\/|$)/, os.homedir());
    try {
      if (AUTO_EXT.has(path.extname(abs).toLowerCase()) && fs.statSync(abs).isFile()) {
        paths.push(abs);
        return `[lampiran: ${path.basename(abs)}]`;
      }
    } catch {}
    return whole;
  });
  return { paths, text: text.trim() };
}
