// Skill: siapkan deskripsi pull request — daftar commit & file yang berubah dibanding branch
// base, diff ringkas, dan struktur deskripsi (ringkasan, perubahan, cara uji, risiko).
import path from "node:path";
import { spawnSync } from "node:child_process";

const MAX_DIFF = 30_000;
const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
};

/** Branch base: argumen pengguna, lalu main/master, lalu origin/HEAD. */
function detectBase(root, given) {
  if (given) return given;
  for (const b of ["main", "master", "origin/main", "origin/master"]) {
    if (git(["rev-parse", "--verify", "--quiet", b], root).ok) return b;
  }
  const head = git(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root).out;
  return head || null;
}

export default {
  name: "pr_description",
  description:
    "Siapkan deskripsi pull request: daftar commit dan file yang berubah dibanding branch base (default main/master), diff ringkas, dan struktur deskripsi. " +
    "Setelah itu tulis deskripsi: ringkasan 1–3 kalimat, daftar perubahan, cara uji yang bisa diikuti reviewer, risiko/migrasi, tautan issue (ikuti playbook commit-pr). " +
    "Jangan mengklaim sudah diuji bila belum dijalankan.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder repo (default folder kerja)." },
      base: { type: "string", description: "Branch base (mis. main). Kosong = deteksi otomatis." },
    },
  },
  async run(input) {
    const root = path.resolve(input.path || process.cwd());
    if (!git(["rev-parse", "--show-toplevel"], root).ok) return `Bukan repo git: ${root}.`;

    const base = detectBase(root, input.base);
    if (!base) return "Branch base tidak ditemukan. Sebutkan branch base (mis. main) lewat parameter base.";
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root).out;
    const range = `${base}...HEAD`;

    const commits = git(["log", "--pretty=- %h %s", range], root).out;
    if (!commits) return `Tidak ada commit di ${branch} dibanding ${base}. Commit perubahan dulu, atau cek branch.`;
    const stat = git(["diff", "--stat", "--no-color", range], root).out;
    let diff = git(["diff", "--no-color", range], root).out;
    if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + "\n… (diff dipotong; baca file lengkap dengan read_file)";

    return [
      `Deskripsi PR: ${branch} → ${base}`,
      "",
      "Commit:", commits,
      "", "File berubah:", stat,
      "", "Diff:", diff,
      "", "Struktur deskripsi (playbook commit-pr):",
      "1. Ringkasan — 1–3 kalimat: apa dan kenapa.",
      "2. Perubahan — poin per area penting.",
      "3. Cara uji — langkah konkret (perintah, input, hasil yang diharapkan).",
      "4. Risiko & dampak — migrasi, perubahan perilaku, fitur di balik flag.",
      "5. Tautan — issue/tiket terkait (kosong bila tidak ada, jangan dikarang).",
      "Catatan: tulis hanya uji yang benar-benar dijalankan. Bila perubahan besar, sarankan pemecahan PR.",
    ].join("\n");
  },
};
