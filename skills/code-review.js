// Skill: siapkan code review — diff perubahan, file yang berubah, perintah verifikasi yang
// tersedia di proyek, dan checklist review. Model lalu membaca file terkait & menilai.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const MAX_DIFF = 40_000;
const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || "").trim(), err: (r.stderr || "").trim() };
};

function verifyCommands(root) {
  const cmds = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    for (const s of ["typecheck", "check", "lint", "test", "build"]) if (pkg.scripts?.[s]) cmds.push(`npm run ${s}`);
    if (!pkg.scripts?.typecheck && !pkg.scripts?.check && fs.existsSync(path.join(root, "tsconfig.json"))) cmds.push("npx tsc --noEmit");
  } catch {}
  if (fs.existsSync(path.join(root, "artisan"))) cmds.push("php artisan test");
  else if (fs.existsSync(path.join(root, "phpunit.xml")) || fs.existsSync(path.join(root, "phpunit.xml.dist"))) cmds.push("vendor/bin/phpunit");
  if (fs.existsSync(path.join(root, "pytest.ini")) || fs.existsSync(path.join(root, "pyproject.toml"))) cmds.push("pytest -q");
  if (fs.existsSync(path.join(root, "go.mod"))) cmds.push("go vet ./... && go test ./...");
  return cmds;
}

export default {
  name: "code_review",
  description:
    "Siapkan code review: ambil diff perubahan (belum di-commit, atau dibanding branch base), daftar file berubah, perintah verifikasi yang tersedia (test/lint/typecheck/build), dan checklist. " +
    "Setelah itu BACA file terkait, nilai sesuai checklist (kebenaran → keamanan → data → performa → kesederhanaan → test), jalankan verifikasi, lalu laporkan temuan dengan lokasi & skenario konkret.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder repo (default folder kerja)." },
      base: { type: "string", description: "Bandingkan dengan branch/commit ini (mis. main). Kosong = perubahan belum di-commit." },
      file: { type: "string", description: "Batasi ke satu file/folder (opsional)." },
    },
  },
  async run(input) {
    const root = path.resolve(input.path || process.cwd());
    if (!git(["rev-parse", "--show-toplevel"], root).ok) return `Bukan repo git: ${root}. Untuk review file tanpa git, baca filenya dengan read_file lalu nilai dengan checklist (playbook code-review).`;
    const range = input.base ? [`${input.base}...HEAD`] : ["HEAD"];
    const scope = input.file ? ["--", input.file] : [];
    const stat = git(["diff", "--stat", ...range, ...scope], root).out;
    let diff = git(["diff", "--no-color", ...range, ...scope], root).out;
    const untracked = input.base ? "" : git(["ls-files", "--others", "--exclude-standard", ...scope], root).out;
    if (!diff && !untracked) return `Tidak ada perubahan untuk direview (${input.base ? `vs ${input.base}` : "belum di-commit"}).`;
    // Isi file baru ikut ditampilkan sebagai diff "+": tanpa ini model membaca
    // "(tidak ada diff)" sebagai "tidak ada perubahan" dan melewatkan file barunya.
    const newFiles = untracked ? untracked.split("\n").filter(Boolean) : [];
    for (const f of newFiles.slice(0, 15)) {
      if (diff.length > MAX_DIFF) break;
      let body;
      try {
        const buf = fs.readFileSync(path.join(root, f));
        if (buf.length > 60_000 || buf.includes(0)) { diff += `\n\n+++ FILE BARU ${f} (besar/biner — baca dengan read_file)`; continue; }
        body = buf.toString("utf8");
      } catch { continue; }
      diff += `\n\n+++ FILE BARU ${f}\n` + body.split("\n").map((l, i) => `+${String(i + 1).padStart(4)}| ${l}`).join("\n");
    }
    if (diff.length > MAX_DIFF) diff = diff.slice(0, MAX_DIFF) + `\n… (diff dipotong; baca file lengkap dengan read_file)`;
    const changed = stat ? stat.split("\n").length - 1 : 0;
    const cmds = verifyCommands(root);
    return [
      `Code review: ${root} (${input.base ? `vs ${input.base}` : "perubahan belum di-commit"})`,
      `ADA PERUBAHAN untuk direview: ${changed} file diubah, ${newFiles.length} file baru.`,
      "", "File diubah:", stat || "(tidak ada file lama yang diubah)",
      newFiles.length ? `\nFile baru: ${newFiles.join(", ")}` : "",
      "", "Diff (termasuk isi file baru):", diff.trim(),
      "", "Perintah verifikasi yang tersedia (jalankan dengan run_command):", cmds.length ? cmds.map((c) => "  " + c).join("\n") : "  (tidak terdeteksi — cek README/Makefile)",
      "", "Checklist (urut prioritas):",
      "1. Kebenaran: logika, kasus tepi (null/kosong/0/unicode/zona waktu), error handling, async/await, perubahan perilaku untuk pemanggil lain.",
      "2. Keamanan: validasi input, injection, XSS, otorisasi/IDOR, secret di kode/log (bisa jalankan review_security mode diff).",
      "3. Data: migrasi aman/reversible, transaksi, idempotensi.",
      "4. Performa: N+1, index, paginasi, loop berat.",
      "5. Kesederhanaan & konsistensi dengan pola repo; duplikasi logika.",
      "6. Test: perubahan teruji? jalankan perintah verifikasi di atas.",
      "Laporkan tiap temuan: file:baris, masalah, skenario konkret pemicu, saran perbaikan. Urutkan dari paling parah; bedakan bug pasti vs saran.",
    ].filter((x) => x !== "").join("\n");
  },
};
