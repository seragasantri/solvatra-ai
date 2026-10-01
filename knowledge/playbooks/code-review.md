# Playbook: Code review

## Ambil konteks
- Lihat diff lengkap (tool code_review / `git diff`), lalu BACA file utuh di sekitar perubahan — bug sering ada di interaksi dengan kode yang tidak ikut di diff.
- Pahami niat perubahan (pesan commit/PR, permintaan user).

## Periksa berurutan (paling penting dulu)
1. **Kebenaran** — logika salah, kasus tepi (null/kosong/0/negatif/unicode/zona waktu), off-by-one, race condition, error tidak ditangani, async tanpa await, resource tidak ditutup, perubahan perilaku yang tidak disengaja bagi pemanggil lain.
2. **Keamanan** — input tidak divalidasi, injection (SQL/command/template), XSS, otorisasi/IDOR, secret di kode/log, SSRF, deserialisasi tidak aman, CORS terlalu longgar.
3. **Data** — migrasi aman & reversible, transaksi, idempotensi, kehilangan data.
4. **Performa** — N+1, query tanpa index, loop berat, memuat semua data tanpa paginasi, kebocoran memori.
5. **Kesederhanaan & konsistensi** — duplikasi logika yang sudah ada, abstraksi tidak perlu, penamaan, mengikuti pola repo.
6. **Test** — apakah perubahan teruji? Test yang ada masih relevan?

## Tulis temuan
- Setiap temuan: lokasi (file:baris), masalah, SKENARIO konkret yang memicu (input/state → hasil salah), dan saran perbaikan.
- Urutkan dari paling parah. Pisahkan "pasti bug" dari "pertimbangan/selera".
- Jangan melaporkan hal yang belum kamu verifikasi dengan membaca kode — kalau ragu, tandai sebagai dugaan.
- Kalau tidak ada masalah berarti, katakan begitu dengan jujur.

## Verifikasi
- Jalankan test/typecheck/lint/build. Untuk temuan penting, kalau bisa buktikan dengan test kecil atau perintah.
