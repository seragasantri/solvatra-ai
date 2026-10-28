// Skill: siapkan rencana tes — file yang berubah, tes yang sudah ada untuk file itu (berdasarkan
// nama), perintah tes yang tersedia di proyek, dan checklist kasus. Model lalu menulis/memperbarui
// tes sesuai playbook tes.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SRC_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|php|py|go)$/;
const git = (args, cwd) => {
  const r = spawnSync("git", args, { cwd, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  return { ok: r.status === 0, out: (r.stdout || "").trim() };
};

function testCommands(root) {
  const cmds = [];
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    if (pkg.scripts?.test) cmds.push("npm test");
    if (pkg.scripts?.["test:unit"]) cmds.push("npm run test:unit");
    if (pkg.scripts?.["test:e2e"]) cmds.push("npm run test:e2e");
  } catch {}
  if (fs.existsSync(path.join(root, "artisan"))) cmds.push("php artisan test");
  else if (fs.existsSync(path.join(root, "phpunit.xml")) || fs.existsSync(path.join(root, "phpunit.xml.dist"))) cmds.push("vendor/bin/phpunit");
  if (fs.existsSync(path.join(root, "pytest.ini")) || fs.existsSync(path.join(root, "pyproject.toml"))) cmds.push("pytest -q");
  if (fs.existsSync(path.join(root, "go.mod"))) cmds.push("go test ./...");
  return cmds;
}

/** Kandidat file tes untuk satu file sumber, berdasarkan konvensi nama umum. */
function candidateTests(file) {
  const dir = path.dirname(file);
  const ext = path.extname(file);
  const base = path.basename(file, ext);
  const names = [
    `${base}.test${ext}`, `${base}.spec${ext}`,
    `${base}_test${ext}`, `test_${base}${ext}`,
    `${base}.test.js`, `${base}.spec.js`,
    `${base}Test.php`, `${base}_test.go`,
    `test_${base}.py`,
  ];
  const under = ["tests", "test", "__tests__", "spec"].flatMap((d) => [
    path.join(d, `${base}.test${ext}`), path.join(d, `${base}.spec${ext}`), path.join(d, `${base}.test.js`),
    path.join(d, `test_${base}.py`), path.join(d, `${base}Test.php`),
  ]);
  return [...new Set([...names.map((n) => path.join(dir, n)), ...under])];
}

export default {
  name: "test_plan",
  description:
    "Siapkan rencana tes untuk perubahan: file sumber yang berubah, tes yang sudah ada untuk file itu, dan perintah tes yang tersedia. " +
    "Setelah itu tulis atau perbarui tes (playbook tes): jalur sukses, batas, galat, dan regresi; lalu jalankan tes dan laporkan hasil apa adanya.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder repo (default folder kerja)." },
      base: { type: "string", description: "Bandingkan dengan branch ini. Kosong = perubahan belum di-commit." },
    },
  },
  async run(input) {
    const root = path.resolve(input.path || process.cwd());
    if (!git(["rev-parse", "--show-toplevel"], root).ok) return `Bukan repo git: ${root}.`;

    const range = input.base ? [`${input.base}...HEAD`] : ["HEAD"];
    const changed = git(["diff", "--name-only", ...range], root).out.split("\n").filter(Boolean);
    const sources = changed.filter((f) => SRC_EXT.test(f) && !/(\.test\.|\.spec\.|_test\.|test_|Test\.php)/.test(f));
    if (!sources.length) return "Tidak ada file sumber yang berubah untuk dibuatkan tes.";

    const lines = [`Rencana tes untuk ${sources.length} file sumber berubah (${input.base ? `vs ${input.base}` : "belum di-commit"}):`, ""];
    for (const f of sources) {
      const found = candidateTests(f).filter((c) => fs.existsSync(path.join(root, c)));
      lines.push(`- ${f}`);
      lines.push(found.length ? `  tes yang ada: ${found.join(", ")}` : "  tes yang ada: BELUM ADA — buat file tes baru mengikuti pola repo");
    }
    const cmds = testCommands(root);
    lines.push("", "Perintah tes yang tersedia (jalankan dengan run_command):");
    lines.push(cmds.length ? cmds.map((c) => "  " + c).join("\n") : "  (tidak terdeteksi — cek README/Makefile)");
    lines.push(
      "", "Kasus yang wajib dicakup (playbook tes):",
      "1. Jalur sukses (happy path) untuk setiap fungsi/endpoint yang berubah.",
      "2. Batas: kosong, nol, nilai sangat besar, duplikat.",
      "3. Galat: input salah, layanan gagal, izin ditolak.",
      "4. Regresi: bila ada bug yang diperbaiki, tambahkan tes yang gagal sebelum perbaikan.",
      "", "Langkah: baca file sumber dan tes yang ada → tulis/perbarui tes → jalankan perintah tes → laporkan hasil apa adanya (lulus/gagal, jumlah tes).",
      "Jangan memakai kredensial produksi atau memanggil API berbayar dari tes; gunakan tiruan (mock).",
    );
    return lines.join("\n");
  },
};
