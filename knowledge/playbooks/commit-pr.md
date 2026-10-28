# Playbook: Pesan commit & deskripsi pull request

## Pesan commit
- **Baris pertama** ≤ 72 karakter, format `area: ringkasan` (contoh: `gateway: pindah model otomatis saat gangguan`). Pakai kalimat aktif, bentuk perintah.
- **Badan pesan** (bila perlu): apa yang berubah dan **kenapa**. Jelaskan alasannya, bukan rinciannya — rincian ada di diff.
- Satu commit, satu perubahan logis. Pisahkan refaktor dari perubahan perilaku.
- Jangan commit file rahasia (`.env`, kunci, token) atau artefak build.

## Deskripsi pull request
Struktur:
1. **Ringkasan** — 1–3 kalimat: apa dan kenapa.
2. **Perubahan** — daftar poin per area penting.
3. **Cara uji** — langkah konkret yang bisa diikuti reviewer (perintah, input, hasil yang diharapkan).
4. **Risiko & dampak** — apa yang bisa rusak, migrasi yang diperlukan, fitur di balik flag.
5. **Tautan** — issue atau tiket terkait.

## Aturan
- Jangan mengklaim sudah diuji bila belum. Tulis apa yang benar-benar dijalankan.
- Perubahan besar dipecah jadi beberapa PR bila memungkinkan.
- Sebelum membuat PR: cek `git status`, pastikan tidak ada file yang tidak diinginkan, dan jalankan tes/typecheck yang tersedia.

## Checklist
- [ ] Baris pertama commit jelas dan ≤ 72 karakter
- [ ] Alasan perubahan tertulis
- [ ] Cara uji bisa diikuti reviewer
- [ ] Tidak ada rahasia atau artefak di dalam commit
