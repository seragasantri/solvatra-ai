// Simpan catatan bebas ke file data/notes.md.
import fs from "node:fs";
import path from "node:path";
export default {
  name: "save_note",
  description: "Simpan catatan teks bebas ke berkas notes.md milik user.",
  input_schema: {
    type: "object",
    properties: { note: { type: "string", description: "Isi catatan." } },
    required: ["note"],
  },
  async run(input, ctx) {
    const file = path.join(ctx.config.dataDir, "notes.md");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const stamp = new Date().toISOString();
    fs.appendFileSync(file, `\n- [${stamp}] ${input.note}\n`);
    return `Catatan tersimpan ke ${file}`;
  },
};
