# Playbook: Frontend

## Sebelum menulis kode
- Deteksi stack dari proyek (package.json / composer.json / struktur folder): React/Next/Vite/Vue/Blade/plain HTML. Ikuti stack itu — jangan mencampur.
- Baca 1–2 komponen/halaman yang sudah ada untuk menyalin pola: struktur folder, penamaan, styling (Tailwind/CSS modules/Bootstrap), state management, cara fetch API, komponen UI yang sudah ada.
- Pakai ulang komponen yang ada (Button, Input, Modal, Table) sebelum membuat baru.

## Saat menulis
- Semantik & aksesibilitas: heading berjenjang, label untuk setiap input, alt pada gambar, tombol = <button>, fokus terlihat, kontras cukup, bisa dipakai keyboard.
- Responsif mobile-first; uji di lebar 360px, 768px, 1280px. Hindari scroll horizontal.
- Setiap tampilan data punya state: loading, kosong, error, sukses. Jangan biarkan halaman diam saat gagal.
- Form: validasi di klien untuk UX, tapi server tetap sumber kebenaran; tampilkan pesan error per field; disable tombol saat submit.
- Keamanan: tidak pernah memasukkan input user ke innerHTML/dangerouslySetInnerHTML tanpa sanitasi; tidak menyimpan secret di kode frontend/VITE_*; token di storage yang tepat.
- Performa: lazy-load halaman/gambar berat, hindari re-render berlebih, ukuran bundle wajar, gambar dengan ukuran tepat.
- File besar ditulis bertahap (write_file create → append).

## Verifikasi
- Jalankan: typecheck (`tsc -b`/`npm run check`), lint, build (`npm run build`). Build harus sukses tanpa error.
- Kalau memungkinkan, jalankan dev server lalu curl halaman/aset untuk memastikan termuat (status 200).
- Laporkan halaman/komponen yang diubah + cara melihatnya.

## Konvensi komponen (proyek user)
- Blade/jQuery: tabel DataTables, select select2, ikon Font Awesome.
- React: tabel TanStack Table, select react-select (shadcn: Combobox), ikon react-icons/lucide-react.
