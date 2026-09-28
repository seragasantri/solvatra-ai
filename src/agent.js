// Inti agent: rakit system prompt (persona + memori relevan + skill),
// simpan riwayat "netral", lalu delegasikan loop ke provider aktif.
import { config } from "./config.js";
import { getProvider } from "./providers/index.js";
import { loadSkills } from "./skills.js";

export function buildSystemPrompt({ memories, skills }) {
  const memBlock = memories.length
    ? memories.map((m) => `- ${m.text}`).join("\n")
    : "(belum ada — kamu baru mengenal user ini)";
  const skillList = skills.length
    ? skills.map((s) => `- ${s.name}: ${s.description}`).join("\n")
    : "(tidak ada skill terpasang)";

  const base = config.persona
    ? config.persona
    : `Kamu adalah ${config.agentName}, asisten AI pribadi yang ringan dan cekatan. Jawab dalam bahasa yang dipakai user (default Bahasa Indonesia), ringkas dan membantu.`;

  return `${base}

## Memori jangka panjang tentang user
Ini yang kamu ingat dari percakapan sebelumnya. Manfaatkan bila relevan:
${memBlock}

## Cara kamu jadi makin pintar
Setiap kali kamu belajar fakta yang tahan lama & berguna tentang user (nama, preferensi, proyek, tujuan, keputusan penting), PANGGIL tool "remember" untuk menyimpannya. Jangan simpan hal sepele. Jangan umumkan bahwa kamu menyimpan memori kecuali user bertanya.

## Skill yang tersedia
${skillList}

Gunakan skill saat memang membantu.

## Membuat skill sendiri
Kalau kamu butuh kemampuan yang BELUM ada sebagai skill, kamu boleh membuatnya lewat tool "create_skill": tentukan name (huruf kecil/angka/garis-bawah), description, input_schema (JSON Schema objek), dan body JavaScript untuk fungsi run(input, ctx). Skill baru langsung tersimpan & aktif untuk giliran berikutnya. Buat skill hanya bila benar-benar berguna dan bisa dipakai ulang; jangan untuk hal sekali pakai. Jelaskan singkat ke user apa yang kamu buat.

## Alur membuat frontend
Saat user minta dibuatkan tampilan/frontend:
1. Kalau user menyebut "template", panggil "frontend_template" action "list" dan tunjukkan pilihan template ke user, lalu tunggu user memilih.
2. Setelah user memilih (atau kalau tanpa template), panggil "frontend" action "detect_stack" pada project user untuk tahu framework & library yang cocok.
3. Kalau pakai template, panggil "frontend_template" action "load" untuk mengambil manifest + design guide + file skeleton. JAGA bahasa desainnya (warna, font, radius, pola glass/glow), ganti brand & nav sesuai program user, dan ADAPTASI ke stack hasil detect_stack (lihat bagian "adapt" di manifest).
4. Susun kode frontend yang menarik & profesional, lalu tulis dengan "frontend" action "write_files" ke folder tujuan yang disepakati user.

## Konvensi komponen frontend (SELALU — dengan atau tanpa template)
Aturan ini berlaku untuk SEMUA pekerjaan frontend web, tidak peduli pakai template atau tidak:
- Jika stack **Blade / server-rendered jQuery** (mis. Laravel): tabel pakai **DataTables**, dropdown/select pakai **select2**, ikon pakai **Font Awesome**.
- Jika stack **JS / React (Next, Vite, dll)**: tabel pakai **TanStack Table** (@tanstack/react-table), dropdown/select pakai **react-select** (di project shadcn boleh Combobox), ikon pakai **react-icons** (lucide-react boleh untuk ikon bawaan shadcn).
Kalau ragu soal stack, panggil "frontend" action "detect_stack" dulu untuk memastikan, lalu pakai komponen yang sesuai. Jangan mencampur konvensi lintas stack.`;
}

export class Agent {
  constructor({ memory, tools, dispatch, skills }) {
    this.memory = memory;
    this.tools = tools;
    this.dispatch = dispatch;
    this.skills = skills;
    this.turns = []; // riwayat netral: {role:'user'|'assistant'|'tool', ...}
    this.provider = getProvider();
    this.reloadSkills = async () => {
      const loaded = await loadSkills();
      this.tools = loaded.tools;
      this.dispatch = loaded.dispatch;
      this.skills = loaded.skills;
      return loaded.skills.length;
    };
  }

  async _runSkill(name, input) {
    const handler = this.dispatch.get(name);
    if (!handler) return `Error: skill "${name}" tidak ditemukan.`;
    try {
      const out = await handler(input || {}, {
        memory: this.memory,
        config,
        reloadSkills: this.reloadSkills,
        listSkills: () => this.skills.map((s) => s.name),
      });
      return typeof out === "string" ? out : JSON.stringify(out);
    } catch (err) {
      return `Error saat menjalankan skill "${name}": ${err.message}`;
    }
  }

  async chat(userInput, { onDelta } = {}) {
    this.turns.push({ role: "user", text: userInput });
    const relevant = this.memory.search(userInput, config.memoryTopK);
    const system = buildSystemPrompt({ memories: relevant, skills: this.skills });

    const { text, turns } = await this.provider.run({
      system,
      turns: this.turns,
      tools: this.tools,
      runSkill: (name, input) => this._runSkill(name, input),
      onDelta,
    });
    this.turns = turns;
    return text;
  }
}
