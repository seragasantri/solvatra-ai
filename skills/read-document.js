// Skill: baca & ekstrak isi dokumen (PDF, Word .docx, teks/kode, CSV, dll).
// Dipakai otomatis saat user menyebut path file dan minta dipelajari/dibaca.
import fs from "node:fs";
import { extractText, isImage } from "../src/extract.js";

export default {
  name: "read_document",
  description:
    "Baca & ekstrak ISI file APA PUN dari perangkat lokal: PDF, Word (.docx), Excel (.xlsx/.xls/.ods), PowerPoint (.pptx), OpenDocument (.odt/.odp), teks/kode/CSV/JSON/HTML, dll. Panggil SECARA OTOMATIS setiap kali user menyebut path sebuah file dan ingin isinya dipelajari/diringkas/dianalisis. Untuk gambar, beritahu user memakai /attach (vision).",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path file yang dibaca." },
      max_chars: { type: "number", description: "Batas karakter yang dikembalikan (default 20000)." },
    },
    required: ["path"],
  },
  async run(input) {
    const p = String(input.path || "").trim().replace(/^['"]|['"]$/g, "");
    if (!p) return "Butuh path file.";
    if (!fs.existsSync(p)) return `File tidak ditemukan: ${p}`;
    const stat = fs.statSync(p);
    if (stat.isDirectory()) return `"${p}" adalah folder. Pakai list_dir.`;
    if (isImage(p)) return `"${p}" adalah gambar. Untuk membacanya, minta user menjalankan: /attach ${p} (dikirim ke model sebagai vision).`;

    let res;
    try { res = await extractText(p); }
    catch (e) { return `Gagal membaca ${p}: ${e.message}`; }
    if (res.error && !res.text) return res.error;

    const max = Math.min(input.max_chars || 20000, 120000);
    const full = res.text || "";
    const head = [`File: ${p}`, `Tipe: ${res.kind}${res.pages ? ` · ${res.pages} halaman` : ""}`, `Panjang teks: ${full.length} char`].join("  ·  ");
    let body = full.slice(0, max);
    if (full.length > max) body += `\n\n… [dipotong; total ${full.length} char — minta lagi dengan max_chars lebih besar bila perlu]`;
    return `${head}\n\n${body}`;
  },
};
