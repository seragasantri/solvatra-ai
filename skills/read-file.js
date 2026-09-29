// Skill: baca isi file dari perangkat lokal (read-only). Untuk ngoding akurat —
// lihat kode asli, bukan menebak. Bisa batasi range baris.
import fs from "node:fs";

export default {
  name: "read_file",
  description:
    "Baca isi sebuah file (read-only) agar bisa memahami/mengubah kode dengan akurat. Opsional batasi rentang baris. Output diberi nomor baris. Panggil ini SEBELUM menulis/mengubah kode yang bergantung pada file itu.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path file yang dibaca." },
      start: { type: "number", description: "Baris awal (1-based, opsional)." },
      end: { type: "number", description: "Baris akhir (inklusif, opsional)." },
    },
    required: ["path"],
  },
  async run(input) {
    const p = String(input.path || "");
    let stat;
    try { stat = fs.statSync(p); } catch { return `File tidak ditemukan: ${p}`; }
    if (stat.isDirectory()) return `"${p}" adalah folder, bukan file. Pakai list_dir.`;
    if (stat.size > 2_000_000) return `File terlalu besar (${stat.size} byte). Baca sebagian via start/end.`;
    const lines = fs.readFileSync(p, "utf8").split("\n");
    const start = Math.max(1, input.start || 1);
    const end = Math.min(lines.length, input.end || lines.length);
    const width = String(end).length;
    const slice = [];
    for (let i = start; i <= end; i++) slice.push(`${String(i).padStart(width)}  ${lines[i - 1]}`);
    let out = slice.join("\n");
    if (out.length > 40000) out = out.slice(0, 40000) + "\n… [dipotong]";
    return `${p} (baris ${start}-${end} dari ${lines.length}):\n${out}`;
  },
};
