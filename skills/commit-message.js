// Skill: siapkan pesan commit — ambil perubahan yang sudah di-stage (atau seluruh perubahan
// bila belum ada yang di-stage), lalu model menulis pesan commit sesuai playbook commit-pr.
import path from "node:path";
import { spawnSync } from "node:child_process";

const MAX_DIFF = 30_000;
const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
};

export default {
  name: "commit_message",
  description:
    "Siapkan pesan commit dari perubahan git: ambil file yang sudah di-stage (atau semua perubahan bila belum ada yang di-stage), statistik, dan diff. " +
    "Setelah itu tulis pesan commit: baris pertama ≤ 72 karakter format `area: ringkasan`, lalu badan pesan berisi alasan perubahan (ikuti playbook commit-pr). " +
    "Jangan commit sendiri kecuali pengguna memintanya; jangan sertakan file rahasia.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder repo (default folder kerja)." },
    },
  },
  async run(input) {
    const root = path.resolve(input.path || process.cwd());
    if (!git(["rev-parse", "--show-toplevel"], root).ok) return `Bukan repo git: ${root}.`;

    const staged = git(["diff", "--cached", "--name-only"], root).out;
    const mode = staged ? "staged" : "working";
    const diffArgs = staged ? ["diff", "--cached"] : ["diff", "HEAD"];
    const files = staged || git(["diff", "HEAD", "--name-only"], root).out;
    if (!files) {
      const untracked = git(["ls-files", "--others", "--exclude-standard"], root).out;
      if (!untracked) return "Tidak ada perubahan untuk dibuatkan pesan commit.";
      return `Tidak ada perubahan yang sudah dilacak. File baru belum di-stage:\n${untracked}\nStage file yang relevan dulu (git add), lalu panggil commit_message lagi.`;
    }

    const stat = git([...diffArgs, "--stat", "--no-color"], root).out;
    let diff = git([...diffArgs, "--no-color"], root).out;
    if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + "\n… (diff dipotong; baca file lengkap dengan read_file)";
    const recent = git(["log", "-5", "--pretty=%s"], root).out;

    return [
      `Pesan commit untuk perubahan ${mode === "staged" ? "yang sudah di-stage" : "belum di-stage (seluruh perubahan terhadap HEAD)"}.`,
      "",
      "File berubah:", stat,
      "", "Gaya 5 commit terakhir (ikuti polanya):", recent || "(belum ada riwayat)",
      "", "Diff:", diff,
      "", "Cara menulis (playbook commit-pr):",
      "- Baris pertama ≤ 72 karakter, format `area: ringkasan`, kalimat aktif bentuk perintah.",
      "- Badan pesan: apa dan kenapa, bukan rincian yang sudah terlihat di diff.",
      "- Bila diff mencampur beberapa perubahan tidak terkait, sarankan dipisah menjadi beberapa commit.",
      "- Pastikan tidak ada .env, kunci, token, atau artefak build di daftar file.",
    ].join("\n");
  },
};
