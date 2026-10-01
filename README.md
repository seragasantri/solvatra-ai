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

Perintahnya **`solvatra-ai`** (alias lama `traga-agent` tetap ada).

```bash
cd ai-agent-traga
npm install
npm link          # daftarkan perintah global 'solvatra-ai'
# alternatif: npm install -g .
```

Lalu dari folder project mana pun:

```bash
cd ~/project-apa-saja
solvatra-ai
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

## Keahlian kerja: playbook & tool

Agent bekerja dengan alur **pahami → cari akar masalah → kerjakan → verifikasi → laporkan jujur**, dan memakai playbook praktis per bidang (tool `playbook`):
`cara-kerja`, `debugging`, `frontend`, `backend`, `devops` (deploy/nginx/systemd/docker), `github`, `code-review`, `security-review` — isinya di `knowledge/playbooks/`.

| Tool | Fungsi |
|---|---|
| `run_command` | Jalankan perintah shell (exit code + output, timeout, sudo dengan password sekali per sesi) |
| `write_file` / `edit_file` / `read_file` | Tulis (bertahap untuk file besar), ubah presisi, baca file |
| `github` | status, diff, log, branch, commit (menolak file secret), push, PR, cek CI (`git` + `gh`) |
| `code_review` | Diff + isi file baru + perintah verifikasi proyek + checklist review |
| `review_security` | Secret bocor, SQL/command injection, XSS, eval, deserialisasi, TLS/CORS/APP_DEBUG, `.env` ter-commit, audit dependency (npm/composer/pip-audit) |

Ukur ketepatan agent dengan model yang dipakai (jalankan di dalam sebuah repo git):

```bash
npm run eval:skills
```

## Login akun Solvatra (wajib)

Agent hanya bisa dipakai setelah login ke akun [solvatra.web.id](https://solvatra.web.id):

```bash
solvatra-ai login     # buka browser -> cocokkan kode -> Setujui
solvatra-ai whoami    # akun yang sedang login
solvatra-ai logout    # cabut key perangkat ini & hapus kredensial lokal
```

Menjalankan `solvatra-ai` tanpa login otomatis memulai alur login. Setelah disetujui, CLI
menerima API key `tg_live_` atas nama akun itu (tersimpan di `~/.ai-agent-traga/auth.json`, mode 0600)
dan memakainya untuk provider `solvatra` — model, kuota, dan batasnya mengikuti paket akun.
Key bisa dicabut dari menu **API Keys** di web; CLI lalu meminta login ulang.
Di server tanpa layar (SSH) set `TRAGA_NO_BROWSER=1` lalu buka URL yang ditampilkan dari perangkat lain.

## Pilihan provider (seperti router)

Pilih lewat env `TRAGA_PROVIDER`, lalu jalankan ulang.

| Mode | Provider | Auth | Catatan |
|---|---|---|---|
| `solvatra` (default) | Solvatra AI Gateway | login akun (`solvatra-ai login`) | model dari `/v1/models` akun; ganti dengan `/model` |
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
| `TRAGA_SERVER_URL` | `https://solvatra.web.id` | server akun Solvatra (login + gateway) |
| `TRAGA_SOLVATRA_MODEL` | model pertama akun | model untuk provider `solvatra` |
| `TRAGA_NO_BROWSER` | — | `1` = jangan buka browser saat login |
| `ANTHROPIC_API_KEY` | — | untuk provider `claude` |
| `TRAGA_MODEL` | `claude-opus-5` | ganti `claude-haiku-4-5` untuk lebih murah/cepat |
| `TRAGA_EFFORT` | `low` | `low`…`max` — naikkan untuk tugas berat |
| `TRAGA_NAME` | `Solvatra` | nama panggilan agent |
| `TRAGA_MEMORY_TOPK` | `8` | jumlah memori yang disuntik per giliran |

## Rilis manual (tanpa CI/CD)

Publikasi dilakukan manual dari mesin ini. Sekali jalan:

```bash
npm run release:patch   # 0.3.2 -> 0.3.3  (perbaikan kecil)
npm run release:minor   # 0.3.x -> 0.4.0  (fitur)
npm run release:major   # 0.x   -> 1.0.0  (perubahan besar)
```

Tiap perintah: naikkan versi + buat tag + push ke GitHub + `npm publish`.
Karena akun npm memakai 2FA, saat `npm publish` akan muncul prompt **OTP** — masukkan kode dari authenticator.

> Agar tak diminta OTP tiap kali: taruh Granular Access Token (publish, *bypass 2FA*) di `~/.npmrc`:
> `//registry.npmjs.org/:_authToken=TOKEN_KAMU` (file ini hanya di mesinmu, jangan di-commit).
