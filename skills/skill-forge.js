// Meta-skill: memungkinkan agent MENULIS skill barunya sendiri.
// Keamanan: nama divalidasi (anti path-traversal), file dirakit dari template
// (struktur dijamin), lalu dites-impor dulu; kalau gagal parse, file dihapus lagi.
// CATATAN: skill hasil buatan agent dieksekusi dengan hak penuh Node — review sebelum dipercaya.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const NAME_RE = /^[a-z][a-z0-9_]{1,48}$/;
// Nama yang tidak boleh ditimpa (skill inti sistem).
const PROTECTED = new Set(["skill-forge", "create_skill"]);

export default {
  name: "create_skill",
  description:
    "Buat sebuah skill (tool) baru saat kemampuan yang dibutuhkan belum ada. Skill langsung tersimpan ke folder skills/ dan aktif untuk giliran berikutnya. Berikan name, description, input_schema (JSON Schema objek), dan run_body (isi fungsi async run(input, ctx) dalam JavaScript, harus mengembalikan string atau nilai yang bisa di-serialize).",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Nama unik: huruf kecil, angka, garis-bawah. Contoh: scan_secrets." },
      description: { type: "string", description: "Penjelasan singkat kegunaan skill (dilihat model & user)." },
      input_schema: {
        type: "object",
        description: "JSON Schema objek untuk argumen skill (properties, required, dst).",
      },
      run_body: {
        type: "string",
        description:
          "Isi fungsi JavaScript untuk `async run(input, ctx)`. ctx berisi { memory, config, reloadSkills, listSkills }. Gunakan `return` untuk hasil.",
      },
      overwrite: { type: "boolean", description: "Izinkan menimpa skill dengan nama sama (default false)." },
    },
    required: ["name", "description", "input_schema", "run_body"],
  },

  async run(input, ctx) {
    const name = String(input.name || "").trim();
    if (!NAME_RE.test(name)) {
      return `Ditolak: nama "${name}" tidak valid. Pakai huruf kecil/angka/garis-bawah, 2–49 karakter.`;
    }
    if (PROTECTED.has(name)) return `Ditolak: "${name}" adalah skill inti dan tidak boleh ditimpa.`;

    const dir = ctx.config.skillsDir;
    // Nama file = nama skill; cegah path traversal (nama sudah divalidasi, tapi resolve tetap dicek).
    const file = path.join(dir, `${name}.js`);
    if (path.dirname(path.resolve(file)) !== path.resolve(dir)) {
      return "Ditolak: path di luar folder skills/.";
    }
    if (fs.existsSync(file) && !input.overwrite) {
      return `Skill "${name}" sudah ada. Set overwrite: true bila memang ingin mengganti.`;
    }

    if (ctx.mode === "manual") return "Mode manual aktif — pembuatan skill dimatikan. Jelaskan rencananya saja.";
    if (typeof ctx.confirm === "function") {
      if (!(await ctx.confirm(`Buat skill baru "${name}"? (akan dieksekusi dgn hak penuh)`))) return "Dibatalkan oleh user.";
    }
        const schemaJson = JSON.stringify(input.input_schema || { type: "object", properties: {} }, null, 2);
    const descJson = JSON.stringify(String(input.description || ""));
    const body = String(input.run_body || "return 'skill kosong';");

    const source = `// dibuat oleh Solvatra (create_skill) pada ${new Date().toISOString()}
// Skill ini berjalan dengan hak penuh Node. Tinjau sebelum dipercaya penuh.
export default {
  name: ${JSON.stringify(name)},
  description: ${descJson},
  input_schema: ${schemaJson},
  async run(input, ctx) {
${body.split("\n").map((l) => "    " + l).join("\n")}
  },
};
`;

    // Tulis file lalu tes-impor. Kalau gagal, kembalikan ke keadaan semula.
    const backup = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
    fs.writeFileSync(file, source);
    try {
      const mod = await import(pathToFileURL(file).href + `?t=${Date.now()}`);
      const sk = mod.default;
      if (!sk || sk.name !== name || typeof sk.run !== "function") {
        throw new Error("modul tidak mengekspor default { name, run } yang benar");
      }
    } catch (e) {
      if (backup === null) fs.unlinkSync(file);
      else fs.writeFileSync(file, backup);
      return `Gagal membuat skill "${name}": ${e.message}. Perbaiki run_body/input_schema lalu coba lagi.`;
    }

    const count = await ctx.reloadSkills();
    return `Skill "${name}" dibuat & aktif (total ${count} skill). File: ${file}. Bisa dipakai mulai giliran berikutnya.`;
  },
};
