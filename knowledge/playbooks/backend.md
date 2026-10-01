# Playbook: Backend (API, Laravel, Express/Node, database)

## Sebelum mengubah
- Petakan alur request: route → middleware (auth, validasi, rate limit) → controller → service → model/query → response.
- Baca kode yang ada untuk konvensi: format respons, penanganan error, validasi (FormRequest/Zod/Joi), struktur folder, penamaan.
- Cek skema DB & migrasi yang ada sebelum menambah kolom/tabel.

## Prinsip implementasi
- Validasi SEMUA input di server (tipe, panjang, format, enum). Tolak yang tidak dikenal.
- Otorisasi di server untuk setiap resource: pastikan data milik user/tenant yang benar (cegah IDOR). Jangan percaya id dari klien.
- Query: pakai parameter binding/ORM; jangan merangkai SQL dengan input user. Cegah N+1 (eager loading), tambah index untuk kolom filter/sort.
- Transaksi untuk operasi multi-langkah yang harus konsisten (bayar → aktivasi → catat).
- Idempoten untuk webhook/pembayaran; tangani retry dan duplikat.
- Error: pesan aman untuk klien (tanpa stack/SQL/path), detail lengkap di log server dengan request id.
- Secret dari env, bukan hardcode. Jangan log password/token.
- Migrasi: tambah dengan aman (nullable/default dulu), jangan menghapus data produksi; sediakan rollback.

## Laravel cepat
- Setelah ubah .env/config: `php artisan config:clear` (atau optimize:clear). Produksi: `config:cache`, `route:cache`.
- Permission: storage/ dan bootstrap/cache dapat ditulis user web (www-data).
- `php artisan migrate --force` di produksi; cek `migrate:status`.
- Subfolder (mis. /task-lpm): APP_URL, ASSET_URL, SESSION_PATH, dan konfigurasi nginx alias + SCRIPT_NAME yang benar.

## Node/Express cepat
- `trust proxy` bila di belakang nginx/Cloudflare; batas ukuran body; helmet; CORS eksplisit.
- Proses dikelola systemd/pm2; log terstruktur.

## Verifikasi
- Jalankan test yang ada (phpunit/pest, npm test, e2e). Tambah test untuk bug yang diperbaiki bila wajar.
- Uji endpoint nyata dengan curl (status code + body), termasuk kasus gagal (input salah, tanpa auth).
- Typecheck/lint/build bila ada. Cek log setelah request.
