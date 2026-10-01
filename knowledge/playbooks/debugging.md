# Playbook: Debugging sistematis

## Alur
1. **Reproduksi** — jalankan langkah yang gagal sendiri (curl, run script, buka endpoint). Catat output persis.
2. **Lokalisasi** — di lapisan mana gagal? (DNS/CDN → web server → app server/PHP-FPM/Node → app → DB/cache/antrian → layanan eksternal)
3. **Bukti** — log di lapisan itu: 
   - nginx: /var/log/nginx/error.log, access.log; `nginx -T` (konfigurasi efektif)
   - systemd: `journalctl -u <svc> -n 200 --no-pager`, `systemctl status <svc>`
   - PHP-FPM: /var/log/php*-fpm.log; Laravel: storage/logs/laravel.log
   - Node/pm2: `pm2 logs <app> --lines 200 --nostream`; Docker: `docker logs --tail 200 <c>`
   - DB: koneksi (`mysql -e 'select 1'`), migrasi, lock
4. **Hipotesis** — satu penyebab paling mungkin, berdasarkan bukti.
5. **Uji hipotesis** — perubahan kecil / perintah yang membuktikan atau membantah.
6. **Perbaiki akar masalah** lalu **verifikasi** gejala awal sudah hilang.
7. **Cegah terulang** bila wajar: test, validasi, monitoring, catatan.

## Peta gejala → penyebab umum
- **404 dari web utama padahal app lain**: blok `location` belum ada / urutan location salah / `server_name` tidak cocok / file di sites-enabled tidak ter-include / cache CDN.
- **502 Bad Gateway**: upstream mati (php-fpm/node), socket/port salah, permission socket, timeout.
- **500**: error aplikasi → baca log app; .env salah; permission storage; extension PHP hilang; migrasi belum jalan.
- **403**: permission file/folder, `autoindex off` tanpa index, aturan deny, SELinux/AppArmor.
- **CORS/mixed content**: origin tidak diizinkan, http vs https di belakang proxy (X-Forwarded-Proto, trust proxy).
- **"Works locally, not in prod"**: versi runtime beda, env var hilang, cache konfigurasi, path absolut, permission, build tidak dijalankan.
- **Lambat**: N+1 query, index hilang, tanpa cache, sinkron ke layanan eksternal, resource habis (top/free -m/df -h).

## Prinsip
- Ubah satu hal per percobaan; kembalikan bila tidak berpengaruh.
- Jangan "memperbaiki" dengan menonaktifkan pengaman (chmod 777, matikan CSRF, verify=false).
- Simpan bukti sebelum & sesudah untuk laporan.
