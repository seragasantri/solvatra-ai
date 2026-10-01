# Playbook: DevOps & deploy aman

## Sebelum menyentuh server
- Kenali cara app berjalan: `systemctl list-units --type=service | grep <app>`, `pm2 ls`, `docker ps`, `ss -ltnp` (port), konfigurasi nginx yang aktif (`nginx -T | grep -n server_name`).
- Cari sumber kebenaran: repo git di server? (`git status`, `git log -1`) — jangan edit kode produksi langsung kalau ada repo; ubah di repo lalu pull.

## Langkah deploy standar
1. Backup: `cp -a dist /tmp/dist-$(date +%Y%m%d-%H%M%S)` / backup konfigurasi / dump DB bila ada migrasi berisiko.
2. Ambil kode: `git pull --ff-only`.
3. Dependency & build: `npm ci && npm run build` / `composer install --no-dev --optimize-autoloader`.
4. Migrasi: `php artisan migrate --force` / `prisma migrate deploy` (pastikan backward compatible).
5. Restart/reload: `systemctl restart <svc>` atau `systemctl reload nginx`.
6. Verifikasi: health endpoint, `curl -I` halaman utama, log 1–2 menit pertama (journalctl -f / tail).
7. Rollback bila gagal: kembalikan backup, restart, verifikasi lagi.

## Nginx
- Selalu `nginx -t` sebelum `systemctl reload nginx`.
- File di sites-enabled IKUT dimuat apa pun ekstensinya (.bak juga!) — pindahkan backup ke luar sites-enabled.
- Urutan location: `= /exact` → `^~ /prefix` → regex `~` → prefix biasa. Untuk app di subfolder pakai `location ^~ /sub/` + `alias` (perhatikan slash di akhir) dan fastcgi `SCRIPT_FILENAME` ke index.php yang benar.
- Di belakang Cloudflare: real IP (`set_real_ip_from` + `real_ip_header CF-Connecting-IP`), X-Forwarded-Proto ke app.
- 413: client_max_body_size; 504: proxy_read_timeout/fastcgi_read_timeout.

## systemd
- Ubah unit → `systemctl daemon-reload` lalu restart. Lihat `systemctl cat <svc>` untuk konfigurasi efektif.
- Log: `journalctl -u <svc> --since "10 min ago" --no-pager`.

## Docker
- `docker compose up -d --build`, cek `docker compose ps` + logs. Image non-root, pin versi, healthcheck.

## Keamanan operasional
- Jangan menampilkan isi .env/secret di output; jangan commit secret.
- Prinsip least privilege; firewall hanya port yang perlu; SSH key, bukan password.
- Catat setiap perubahan produksi (apa, kapan, backup di mana).
