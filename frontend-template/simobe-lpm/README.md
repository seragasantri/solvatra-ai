# Template: simobe-lpm — Glassmorphic Cyber-Tech Admin

Dipelajari & disuling dari project **SIM OBE (simobe-lpm)** — Laravel Blade + Tailwind + Alpine.js.
Ini template LAYOUT untuk panel admin/SIM: **layout shell, sidebar, header, login**.

## Bahasa desain (wajib dijaga saat generate)
- **Vibe:** glassmorphism + "cyber-tech". Panel semi-transparan (`bg-*/90` + `backdrop-blur-xl`), border tipis (`border-slate-800/80`), sudut membulat (`rounded-2xl`).
- **Aksen glow gradien:** garis tipis `bg-gradient-to-r from-blue-500 via-sky-400 to-orange-500` di tepi atas sidebar/header; efek blur glow di belakang logo.
- **Tipografi:** `Inter` untuk teks, `JetBrains Mono` untuk label kecil/badge/kode (`font-mono`). Judul `font-black`.
- **Warna:** navy gelap (#07122e/#0c1d45/#152e66) untuk sidebar & login; aksen cyber sky #38bdf8, blue #2563eb, indigo #6366f1, orange #f97316, emerald #10b981.
- **Dark mode:** berbasis class, mode light/dark/system disimpan via Alpine `$persist` (segmented switcher 3 tombol di header).
- **Animasi:** `float`, `shimmer`, `glow-pulse` (didefinisikan di tokens.css) — dipakai hemat, untuk background & CTA.

## Struktur layout
```
<html dark-mode>
  body (bg-gray-50 dark:bg-slate-950)
    div.min-h-screen  x-data: { sidebarOpen: persist(false), mobileMenuOpen:false }
      [mobile overlay]
      <x-sidebar/>   fixed left, w-64 (buka) / w-20 (tutup), slide-in di mobile
      <x-header/>    fixed top, offset kiri mengikuti sidebar
      <main pt-20, lg:ml-64/20> @yield('content')
```
- **Sidebar:** brand header (logo + glow + nama app + badge versi), lalu daftar nav (grup collapsible pakai Alpine). Saat collapse (w-20) label disembunyikan, sisakan ikon.
- **Header:** tombol toggle sidebar (desktop) + hamburger (mobile), judul halaman bergradien, theme switcher 3-mode, dropdown profil (nama, role, logout).
- **Login:** full-screen `.tech-mesh-bg`, kartu `.glass-card-dark` di tengah, brand + form (email/password) + tombol CTA bergradien.

## Cara pakai template ini
1. Jaga token warna, font, radius, dan pola glass+glow di atas.
2. Ganti **brand** (nama app, logo, badge) dan **item nav** sesuai program user.
3. **Sesuaikan ke stack yang dipakai user** (lihat `template.json > adapt`): Blade → pakai langsung; React/Next → Layout component + state; Vue → script setup + useStorage. Kelas Tailwind terbawa 1:1.
4. Untuk aplikasi non-Tailwind, pindahkan token ke CSS variabel di `tokens.css`.

File skeleton ada di folder ini (`layout.blade.php`, `partials/*`, `auth/login.blade.php`, `css/tokens.css`) — pakai sebagai acuan struktur & kelas, bukan copy mentah brand SIM OBE.

## Konvensi library (WAJIB diikuti saat generate)
Template Blade ini memakai:
- **Tabel:** DataTables (jQuery) — https://datatables.net . Inisialisasi di `@push('scripts')` (`$('#tabel').DataTable({...})`).
- **Dropdown:** select2 — https://select2.org (searchable/multi). Init: `$('.select2').select2()`.
- **Ikon:** Font Awesome — https://fontawesome.com/icons . Pakai `<i class="fa-solid fa-...">`.
Jangan pakai TanStack/react-select/react-icons di template Blade.
