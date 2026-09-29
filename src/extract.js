// Ekstraksi teks dari BANYAK jenis file + deteksi gambar.
// Dipakai skill read_document & perintah /attach.
import fs from "node:fs";
import path from "node:path";

const IMG_MT = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
};
const TEXT_EXT = new Set([".txt",".md",".markdown",".csv",".tsv",".json",".jsonl",".yml",".yaml",".xml",".html",".htm",".log",".ini",".toml",".env",
  ".js",".jsx",".ts",".tsx",".mjs",".cjs",".php",".py",".rb",".go",".java",".kt",".rs",".c",".h",".cpp",".cs",".css",".scss",".less",".sql",".sh",".bash",".zsh",".vue",".svelte",".dart",".swift"]);

export function isImage(p) { return path.extname(p).toLowerCase() in IMG_MT; }
export function imageMediaType(p) { return IMG_MT[path.extname(p).toLowerCase()] || null; }

// Deteksi biner: banyak byte NUL / non-teks pada sampel awal.
function looksBinary(buf) {
  const n = Math.min(buf.length, 4000);
  let bad = 0;
  for (let i = 0; i < n; i++) { const c = buf[i]; if (c === 0) return true; if (c < 9 || (c > 13 && c < 32)) bad++; }
  return bad / (n || 1) > 0.3;
}

async function fromPdf(file) {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(fs.readFileSync(file)) });
  try { const r = await parser.getText(); return { kind: "pdf", text: r.text || "", pages: r.total ?? r.pages }; }
  finally { try { await parser.destroy?.(); } catch {} }
}
async function fromDocx(file) {
  const mammoth = (await import("mammoth")).default ?? (await import("mammoth"));
  const r = await mammoth.extractRawText({ path: file });
  return { kind: "docx", text: r.value || "" };
}
async function fromSpreadsheet(file, kind) {
  const XLSX = (await import("xlsx")).default ?? (await import("xlsx"));
  const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
  const parts = [];
  for (const name of wb.SheetNames) {
    const csv = XLSX.utils.sheet_to_csv(wb.Sheets[name]);
    if (csv.trim()) parts.push(`# Sheet: ${name}\n${csv}`);
  }
  return { kind, text: parts.join("\n\n"), sheets: wb.SheetNames.length };
}
// pptx/odt/odp/ods: buka ZIP, ambil XML relevan, buang tag.
async function fromZipXml(file, kind) {
  const JSZip = (await import("jszip")).default ?? (await import("jszip"));
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const strip = (xml) => xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  let names = [];
  if (kind === "pptx") names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  else names = Object.keys(zip.files).filter((n) => /(^|\/)content\.xml$/.test(n)); // odt/odp/ods
  const parts = [];
  for (const n of names) {
    const xml = await zip.file(n).async("string");
    // Ambil teks di antara <a:t>…</a:t> (ooxml) bila ada, else strip semua tag.
    const runs = xml.match(/<a:t>[\s\S]*?<\/a:t>/g);
    const txt = runs ? runs.map((r) => r.replace(/<[^>]+>/g, "")).join(" ") : strip(xml);
    if (txt.trim()) parts.push(kind === "pptx" ? `# ${n.replace("ppt/slides/","")}\n${txt}` : txt);
  }
  return { kind, text: parts.join("\n\n") };
}

export async function extractText(file) {
  const ext = path.extname(file).toLowerCase();
  try {
    if (ext === ".pdf") return await fromPdf(file);
    if (ext === ".docx") return await fromDocx(file);
    if (ext === ".doc") return { kind: "doc", text: "", error: "Format .doc lama tidak didukung; simpan sebagai .docx atau PDF." };
    if ([".xlsx",".xls",".xlsm",".ods"].includes(ext)) return await fromSpreadsheet(file, "spreadsheet");
    if (ext === ".pptx" || ext === ".potx") return await fromZipXml(file, "pptx");
    if (ext === ".odt" || ext === ".odp") return await fromZipXml(file, ext.slice(1));
    if (ext in IMG_MT) return { kind: "image", mediaType: IMG_MT[ext], error: "Gunakan /attach untuk mengirim gambar ke model (vision)." };
    if (TEXT_EXT.has(ext) || ext === "") return { kind: "text", text: fs.readFileSync(file, "utf8") };
  } catch (e) {
    return { kind: ext.slice(1) || "?", text: "", error: `Gagal mengekstrak (${ext}): ${e.message}` };
  }
  // Ekstensi tak dikenal: coba teks, tapi jika biner beri pesan jelas.
  const buf = fs.readFileSync(file);
  if (looksBinary(buf)) return { kind: "binary", text: "", error: `File biner (${ext || "tanpa ekstensi"}, ${buf.length} byte) — tidak bisa diekstrak sebagai teks.` };
  return { kind: "text", text: buf.toString("utf8") };
}
