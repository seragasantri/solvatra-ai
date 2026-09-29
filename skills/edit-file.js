// Skill: ubah file dengan penggantian string PERSIS (seperti tool Edit) atau buat file baru.
// Butuh konfirmasi user (ctx.confirm). Akurat: old_string harus unik kecuali replace_all.
import fs from "node:fs";
import path from "node:path";

export default {
  name: "edit_file",
  description:
    "Ubah kode secara akurat: ganti old_string dengan new_string di sebuah file (harus cocok persis). Untuk buat file baru: set old_string kosong. Setiap perubahan minta persetujuan user. Selalu read_file dulu agar old_string cocok persis.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Path file." },
      old_string: { type: "string", description: "Teks lama yang diganti (kosong untuk buat file baru)." },
      new_string: { type: "string", description: "Teks pengganti / isi file baru." },
      replace_all: { type: "boolean", description: "Ganti semua kemunculan (default false = harus unik)." },
    },
    required: ["path", "new_string"],
  },
  async run(input, ctx) {
    if (ctx.mode === "manual") return "Mode manual aktif — aksi tulis file dimatikan. Jelaskan rencana perubahannya saja, jangan menulis file.";
    const p = String(input.path || "");
    if (!p) return "Butuh path.";
    const old = input.old_string ?? "";
    const neu = input.new_string ?? "";
    const exists = fs.existsSync(p);

    let action, preview;
    if (!exists && old === "") { action = "create"; preview = `Buat file baru: ${p} (${neu.split("\n").length} baris)`; }
    else if (!exists) return `File tidak ada: ${p}. Untuk buat baru, kosongkan old_string.`;
    else {
      const content = fs.readFileSync(p, "utf8");
      if (old === "") return `File "${p}" sudah ada. Beri old_string untuk mengubah, atau hapus dulu.`;
      const count = content.split(old).length - 1;
      if (count === 0) return `old_string tidak ditemukan di ${p}. read_file dulu & salin persis.`;
      if (count > 1 && !input.replace_all) return `old_string muncul ${count}x. Set replace_all:true atau perbesar konteks agar unik.`;
      action = "edit"; preview = `Ubah ${p} (${count} kemunculan)`;
    }

    if (typeof ctx.confirm === "function") {
      if (!(await ctx.confirm(`${preview}`))) return "Dibatalkan oleh user.";
    } else if (process.env.SOLVATRA_ALLOW_WRITE !== "1") {
      return "edit_file butuh konfirmasi interaktif atau SOLVATRA_ALLOW_WRITE=1.";
    }

    if (action === "create") {
      fs.mkdirSync(path.dirname(path.resolve(p)), { recursive: true });
      fs.writeFileSync(p, neu);
      return `Dibuat: ${p}`;
    }
    const content = fs.readFileSync(p, "utf8");
    const updated = input.replace_all ? content.split(old).join(neu) : content.replace(old, neu);
    fs.writeFileSync(p, updated);
    return `Diubah: ${p}`;
  },
};
