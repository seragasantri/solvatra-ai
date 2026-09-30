// Skill: tulis file utuh (buat/timpa) atau tambahkan ke akhir file (append).
// Dibuat untuk model apa pun: parameternya sedikit & sederhana, dan file besar bisa
// ditulis bertahap (mode "append") supaya tidak terpotong batas output model.
import fs from "node:fs";
import path from "node:path";

const kb = (n) => (n / 1024).toFixed(1) + " KB";

export default {
  name: "write_file",
  description:
    "Tulis file ke disk. mode 'create' (default, gagal bila file sudah ada), 'overwrite' (timpa isi), atau 'append' (tambahkan ke akhir). " +
    "File besar (> ~150 baris) WAJIB ditulis bertahap: panggilan pertama mode create/overwrite berisi bagian awal, lalu mode append untuk bagian berikutnya. " +
    "Untuk mengubah sebagian kecil file yang sudah ada, pakai edit_file.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path file (relatif ke folder kerja atau absolut)." },
      content: { type: "string", description: "Isi yang ditulis (untuk append: potongan berikutnya)." },
      mode: { type: "string", enum: ["create", "overwrite", "append"], description: "create | overwrite | append (default create)." },
    },
    required: ["path", "content"],
  },
  async run(input, ctx) {
    if (ctx.mode === "manual") return "Mode manual aktif — menulis file dimatikan. Jelaskan rencananya saja.";
    const p = String(input.path || "").trim();
    if (!p) return "Error: butuh path.";
    if (typeof input.content !== "string") return "Error: butuh content (string).";
    const mode = ["create", "overwrite", "append"].includes(input.mode) ? input.mode : "create";
    const abs = path.resolve(p);
    const exists = fs.existsSync(abs);
    if (exists && fs.statSync(abs).isDirectory()) return `Error: ${p} adalah folder, bukan file.`;
    if (mode === "create" && exists) return `File ${p} sudah ada. Pakai mode "overwrite" untuk menimpa, "append" untuk menambah, atau edit_file untuk mengubah sebagian.`;
    if (mode === "append" && !exists) return `File ${p} belum ada. Panggil dulu mode "create" dengan bagian pertama, baru "append".`;

    const countLines = (t) => (t ? t.split("\n").length - (t.endsWith("\n") ? 1 : 0) : 0);
    const lines = countLines(input.content);
    const verb = mode === "append" ? `Tambah ${lines} baris ke` : mode === "overwrite" && exists ? `Timpa` : `Buat file`;
    // Append bagian berikutnya dari file yang sama tidak perlu ditanya ulang.
    const needConfirm = mode !== "append";
    if (needConfirm) {
      if (typeof ctx.confirm === "function") {
        if (!(await ctx.confirm(`${verb} ${p} (${lines} baris)`))) return "Dibatalkan oleh user.";
      } else if (process.env.SOLVATRA_ALLOW_WRITE !== "1") {
        return "write_file butuh konfirmasi interaktif atau SOLVATRA_ALLOW_WRITE=1.";
      }
    }

    fs.mkdirSync(path.dirname(abs), { recursive: true });
    if (mode === "append") fs.appendFileSync(abs, input.content);
    else fs.writeFileSync(abs, input.content);
    const size = fs.statSync(abs).size;
    const total = countLines(fs.readFileSync(abs, "utf8"));
    return `${mode === "append" ? "Ditambahkan ke" : exists ? "Ditimpa" : "Dibuat"}: ${abs} (+${lines} baris; total ${total} baris, ${kb(size)})`;
  },
};
