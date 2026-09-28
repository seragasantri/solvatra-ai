# solvatra-ai

AI agent CLI ringan bergaya Hermes: chat + **memori persisten** + **skill system** (agent bisa bikin skill sendiri) + **generator frontend** berbasis template. Multi-provider: Claude / OpenAI(Codex) / custom router.

## Pakai instan (tanpa install)
```bash
npx solvatra-ai
```

## Install global (di laptop mana pun)
```bash
npm install -g solvatra-ai
solvatra-ai
```

> Perintah: `solvatra-ai` (alias: `traga-agent`). Butuh Node.js >= 20.
> Set kredensial di `~/.ai-agent-traga/.env` (lihat bagian "Install global" di bawah).

---


AI agent pribadi yang **ringan** bergaya Hermes: chat lewat terminal, punya **memori persisten**, dan **skill system** yang bisa ditambah cuma dengan menaruh satu file. Makin sering diajak ngobrol, makin banyak yang diingat → makin "pintar" soal kamu.

Cuma satu dependency: `@anthropic-ai/sdk`.

## Cara pakai

```bash
cd ai-agent-traga
npm install

# set kunci API (salah satu):
cp .env.example .env          # lalu isi ANTHROPIC_API_KEY
# atau: export ANTHROPIC_API_KEY=sk-ant-...

npm start                     # mulai ngobrol
```

Perintah di dalam chat: `/help` `/memory` `/forget <id>` `/skills` `/exit`.

## Kenapa "makin pintar"

- Setiap fakta tahan lama tentang kamu (nama, preferensi, proyek, keputusan) disimpan agent
  ke `data/memory.json` lewat skill `remember`.
- Tiap giliran, memori yang paling relevan dengan pesanmu **disuntik otomatis** ke system
  prompt — jadi agent ingat lintas sesi, bukan cuma dalam satu percakapan.
- Retrieval-nya ringan (overlap kata kunci), tanpa database atau embedding.

## Struktur

```
src/
  index.js     REPL / CLI
  agent.js     loop utama (streaming + tool-loop) & perakitan system prompt
  memory.js    memory store persisten + pencarian relevansi
  skills.js    loader skill otomatis
  config.js    konfigurasi (env-overridable)
skills/        satu file = satu kemampuan (otomatis jadi tool)
  remember, recall, get_time, calculator, save_note
data/          memori, sesi, catatan (gitignored)
```

## Menambah skill baru

Buat file di `skills/`, contoh `skills/cuaca.js`:

```js
export default {
  name: "get_weather",
  description: "Ambil ramalan cuaca sebuah kota.",
  input_schema: {
    type: "object",
    properties: { city: { type: "string" } },
    required: ["city"],
  },
  async run(input, ctx) {
    // ctx = { memory, config }
    return `Cuaca ${input.city}: cerah 30°C`; // ganti dengan panggilan API asli
  },
};
```

Restart, dan agent langsung bisa memakainya. Tidak perlu ubah kode lain.

## Install global (dipakai di mana saja, seperti Claude Code / Hermes)

Perintahnya **`traga-agent`** (nama `traga` sudah dipakai Hermes, jadi tidak ditabrak).

```bash
cd ai-agent-traga
npm install
npm link          # daftarkan perintah global 'traga-agent'
# alternatif: npm install -g .
```

Lalu dari folder project mana pun:

```bash
cd ~/project-apa-saja
traga-agent
```

### Di mana data & konfigurasi disimpan (global)
Semua state disimpan di **`~/.ai-agent-traga/`** (bukan di folder package), jadi tetap ada walau package dipindah/di-reinstall:

| Isi | Lokasi |
|---|---|
| Memori & sesi | `~/.ai-agent-traga/data/` |
| Skill buatan agent | `~/.ai-agent-traga/skills/` |
| Template buatanmu | `~/.ai-agent-traga/frontend-template/` |
| Kredensial | `~/.ai-agent-traga/.env` (atau env var, atau `.env` di folder project saat ini) |

Skill & template **bawaan** tetap di dalam package; yang buatan user di home dir menimpa/menambah bawaan. Override lokasi home dengan env `TRAGA_HOME`.

Kredensial dibaca berurutan: `.env` di folder saat ini → `~/.ai-agent-traga/.env` → `.env` package. Untuk pemakaian global, taruh di `~/.ai-agent-traga/.env`:

```bash
mkdir -p ~/.ai-agent-traga
cat > ~/.ai-agent-traga/.env <<EOF
TRAGA_PROVIDER=custom
TRAGA_CUSTOM_BASE_URL=https://router.tragasolusi.com/v1
TRAGA_CUSTOM_API_KEY=...
TRAGA_CUSTOM_MODEL=ocg/deepseek-v4-flash-vision-exp
EOF
```

## Tiga pilihan provider (seperti router)

Pilih lewat env `TRAGA_PROVIDER`, lalu jalankan ulang.

| Mode | Provider | Auth | Catatan |
|---|---|---|---|
| `claude` | Claude / Anthropic (resmi) | `ANTHROPIC_API_KEY` **atau** `ANTHROPIC_AUTH_TOKEN` (OAuth/SSO resmi) | jalur OAuth resmi via beta header `oauth-2025-04-20` |
| `codex` | Codex / OpenAI (resmi) | `OPENAI_API_KEY` (API key / OAuth bearer resmi) | endpoint `api.openai.com`, format OpenAI |
| `custom` | Router OpenAI-compatible mana pun | `TRAGA_CUSTOM_*` | OpenRouter / LiteLLM / ai-gateway — set `BASE_URL`+`MODEL`+`API_KEY` |

Contoh:

```bash
TRAGA_PROVIDER=claude ANTHROPIC_API_KEY=sk-ant-... npm start
TRAGA_PROVIDER=codex  OPENAI_API_KEY=sk-...        npm start
TRAGA_PROVIDER=custom \
  TRAGA_CUSTOM_BASE_URL=https://openrouter.ai/api/v1 \
  TRAGA_CUSTOM_MODEL=anthropic/claude-3.5-sonnet \
  TRAGA_CUSTOM_API_KEY=... npm start
```

> **Soal "SSO resmi":** untuk Claude, OAuth token resmi didukung. Untuk Codex/OpenAI, auth resmi dari app pihak-ketiga = API key atau OAuth bearer dari org/SSO kamu. Membajak token login "Sign in with ChatGPT" milik Codex CLI untuk dipakai app lain **tidak** didukung (melanggar ToS) dan tidak diimplementasikan.

## Konfigurasi (env)

| Variabel | Default | Keterangan |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | wajib |
| `TRAGA_MODEL` | `claude-opus-5` | ganti `claude-haiku-4-5` untuk lebih murah/cepat |
| `TRAGA_EFFORT` | `low` | `low`…`max` — naikkan untuk tugas berat |
| `TRAGA_NAME` | `Traga` | nama panggilan agent |
| `TRAGA_MEMORY_TOPK` | `8` | jumlah memori yang disuntik per giliran |
