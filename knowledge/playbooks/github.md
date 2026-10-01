# Playbook: Git & GitHub

## Sebelum commit
- `git status` + `git diff` — pahami persis apa yang berubah. Jangan commit file yang tidak terkait (build output, .env, log, node_modules).
- Kalau ada perubahan milik orang lain/sesi lain yang belum di-commit, jangan ikut di-commit tanpa tahu isinya — commit hanya file yang kamu ubah (`git add <path>`), bukan `git add -A` sembarangan.
- Jalankan test/build yang relevan sebelum commit.

## Commit
- Satu commit = satu perubahan logis. Pesan: baris pertama ringkas (≤ 72 karakter, gaya repo — mis. `fix(auth): …`), lalu paragraf alasan (KENAPA, bukan hanya apa).
- Ikuti bahasa & konvensi pesan commit yang sudah ada di `git log --oneline -10`.

## Branch & PR
- Jangan langsung bekerja di main untuk perubahan besar: `git switch -c fix/<topik>`.
- Push: `git push -u origin <branch>`. Jangan force push ke branch bersama.
- PR (`gh pr create`): judul jelas; deskripsi berisi ringkasan, alasan, cara menguji, dan risiko. Tautkan issue bila ada.
- Cek CI: `gh pr checks` / `gh run list` / `gh run view <id> --log-failed`. Perbaiki yang merah sebelum minta merge.

## Membaca riwayat
- `git log --oneline -20`, `git log -p -- <file>`, `git blame -L a,b <file>` untuk tahu kenapa kode ditulis begitu.
- `git show <sha>` untuk melihat satu perubahan.

## Pemulihan aman
- Batalkan perubahan file belum di-commit: `git restore <file>` (pastikan memang ingin dibuang).
- Batalkan commit yang sudah di-push: `git revert <sha>` (bukan reset --hard + force push).
- Konflik: baca kedua sisi, gabungkan dengan sadar, jalankan test, baru lanjutkan rebase/merge.

## Larangan
- Jangan commit secret (.env, kunci, token). Kalau terlanjur: cabut/rotasi secret-nya — menghapus dari riwayat saja tidak cukup.
- Jangan `push --force` ke main, jangan menghapus branch orang lain, jangan merge tanpa CI hijau kecuali diminta.
