# Playbook: Review keamanan (defensif)

Tujuan: menemukan & memperbaiki kerentanan di aplikasi/server MILIK user. Bukan untuk menyerang sistem orang lain.

## Alur
1. Jalankan tool `review_security` (proyek atau diff) untuk temuan awal: secret bocor, pola berbahaya, dependency rentan.
2. VERIFIKASI setiap temuan dengan membaca kodenya: apakah input benar-benar dari user? sudah disanitasi/divalidasi di tempat lain? Buang false positive.
3. Tinjau manual area yang tidak tertangkap pola (logika otorisasi, alur bisnis).
4. Laporan: severity (Kritis/Tinggi/Sedang/Rendah), lokasi, skenario serangan konkret, dampak, perbaikan. Perbaiki bila diminta, lalu verifikasi.

## Checklist (OWASP Top 10 & umum)
- **Akses (A01)**: setiap endpoint cek autentikasi DAN kepemilikan resource (IDOR). Endpoint admin dijaga peran. Tidak ada endpoint debug/terbuka.
- **Kriptografi (A02)**: password di-hash (bcrypt/argon2), HTTPS di mana-mana, secret tidak di repo, cookie Secure/HttpOnly/SameSite.
- **Injection (A03)**: SQL pakai binding; perintah shell tanpa input mentah (pakai array args, escape); template engine auto-escape; NoSQL operator injection.
- **Desain (A04)**: rate limit login/OTP/reset, lockout, CAPTCHA bila perlu; alur pembayaran diverifikasi server (webhook bertanda tangan).
- **Konfigurasi (A05)**: APP_DEBUG/NODE_ENV produksi, header keamanan (CSP, HSTS, X-Content-Type-Options, frame-ancestors), CORS eksplisit, listing direktori mati, file .env/.git tidak bisa diakses publik.
- **Komponen rentan (A06)**: `npm audit`, `composer audit`, `pip-audit`; perbarui yang kritis.
- **Autentikasi (A07)**: sesi dicabut saat logout/reset password, token kedaluwarsa, MFA untuk admin.
- **Integritas (A08)**: deserialisasi data tak tepercaya (unserialize, pickle, yaml.load) dihindari; dependency dari sumber resmi.
- **Logging (A09)**: login gagal & aksi sensitif dicatat; log tidak berisi password/token.
- **SSRF (A10)**: URL dari user divalidasi, blokir IP privat/metadata (169.254.169.254), batasi redirect.
- **Upload**: validasi tipe & ukuran, nama acak, simpan di luar web root atau tanpa eksekusi PHP.
- **XSS**: escape output; hindari innerHTML/dangerouslySetInnerHTML/{!! !!} dengan data user; CSP.

## Server
- Port terbuka seperlunya (`ss -ltnp`), firewall aktif, SSH key-only, update keamanan OS, service berjalan non-root, permission file wajar (bukan 777).

## Larangan
- Jangan mencoba eksploit ke sistem yang bukan milik user. Jangan menampilkan secret yang ditemukan secara utuh — tampilkan tersamar (abc•••xyz) dan sarankan rotasi.
