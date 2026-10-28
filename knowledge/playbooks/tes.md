# Playbook: Menulis tes (unit, integrasi, e2e)

## Alur
1. **Pahami yang diuji** — baca fungsi/endpoint dan kontraknya (input, output, galat). Cari tes yang sudah ada dan ikuti gayanya.
2. **Tentukan jenis** — unit untuk logika murni; integrasi untuk database/layanan; e2e untuk alur pengguna.
3. **Pilih kasus**
   - Jalur sukses (happy path)
   - Batas: nilai kosong, nol, sangat besar, duplikat
   - Galat: input salah, layanan gagal, izin ditolak
   - Regresi: bug yang pernah terjadi
4. **Tulis tes dulu yang gagal** bila memungkinkan, lalu perbaiki kode sampai lulus.
5. **Jalankan** seluruh tes yang relevan, bukan hanya yang baru.

## Aturan
- Satu tes, satu perilaku. Nama tes menjelaskan perilakunya ("menolak email kosong").
- Tes tidak bergantung pada urutan atau waktu nyata. Gunakan data tetap dan tiruan (mock) untuk layanan luar.
- Jangan mengubah tes agar lulus tanpa alasan. Jika tes salah, jelaskan kenapa.
- Jangan memakai kredensial produksi atau memanggil API berbayar dari tes.

## Jebakan umum
- Tes hijau tapi tidak menguji apa-apa (assert hilang atau terlalu longgar).
- Tes bergantung pada data bersama antar-tes.
- Snapshot yang diperbarui tanpa diperiksa.

## Checklist
- [ ] Jalur sukses, batas, dan galat tercakup
- [ ] Nama tes menjelaskan perilakunya
- [ ] Tes berjalan sendiri-sendiri dan berulang dengan hasil sama
- [ ] Tes lulus dijalankan sebelum melapor
