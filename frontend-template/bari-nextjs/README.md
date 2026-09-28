# Template: bari-nextjs — shadcn/ui Dashboard (dark rail, light canvas)

Disuling dari aplikasi **BARI** (Next.js 16 + React 19 + TS + Tailwind 4 + shadcn/ui).
Template LAYOUT untuk panel admin modern berbasis React/Next: **layout shell, sidebar, header, login, theme toggle**.

## Bahasa desain (wajib dijaga)
- **Pola "dark rail, light canvas":** sidebar SELALU gelap (token `--sidebar` oklch navy) meski app di mode terang. Kanvas & header mengikuti tema.
- **shadcn/ui** sebagai basis: `Sidebar` (`collapsible="icon"`), `SidebarProvider`, `SidebarInset`, `SidebarTrigger`, `Button`, `Input`, dsb. Jangan bikin ulang dari nol — pasang via `npx shadcn add`.
- **Warna:** token `oklch`. Primary cyan `oklch(0.6 0.18 210)`; sidebar navy `oklch(0.17 0.018 255)` dengan `--sidebar-primary` cyan terang `oklch(0.72 0.15 210)`.
- **Aksen khas `.shell-sweep`:** garis cahaya tipis berjalan di tepi bawah header & header-sidebar (animasi 5s pakai `--sidebar-primary`). Menu aktif = glow cyan + titik indikator.
- **Header:** `sticky top-0`, `bg-background/70 backdrop-blur-xl`, tinggi 16 (menyusut ke 12 saat sidebar icon-mode), isi: trigger + breadcrumb (kiri), role/aksi + ThemeToggle (kanan).
- **Dark mode:** `next-themes` (light/dark/system) lewat `ThemeToggle` dropdown; `@custom-variant dark (&:is(.dark *))` di Tailwind 4.
- **Ikon:** `lucide-react`. **Toast:** `sonner`.
- **Login:** kartu terang, input `rounded-xl` fokus ring biru, CTA gradien `from-blue-600 to-emerald-600`, plus tombol **SSO** terpisah + show/hide password.

## Struktur
```
app/(panel)/layout.tsx     SidebarProvider > <AppSidebar/> + <SidebarInset><PanelHeader/>{children}</SidebarInset>
components/app-sidebar.tsx  SidebarHeader(brand) + NavMain(dari config) + SidebarFooter(NavUser) + SidebarRail
components/panel-header.tsx SidebarTrigger + Separator + Breadcrumb ... ThemeToggle
components/theme-toggle.tsx dropdown light/dark/system
components/login-form.tsx   form kredensial + SSO
app/globals.css             token oklch + token sidebar dark-rail + .shell-sweep + gaya menu aktif
```

## Prasyarat
```
npx shadcn@latest add sidebar button input separator dropdown-menu tooltip breadcrumb
npm i next-themes lucide-react sonner
```

## Cara pakai
1. Jaga pola dark-rail, token oklch, `.shell-sweep`, dan basis shadcn.
2. Ganti **brand** (logo, "BARI", subtitle) dan **NAV items** (dari objek konfigurasi) sesuai program user.
3. Sesuaikan **auth** ke sistem user (contoh memakai next-auth `signIn` + endpoint SSO — ganti sesuai kebutuhan).
4. Untuk stack non-Next lihat `template.json > adapt`. Untuk Laravel/Blade, pakai template **simobe-lpm**, bukan ini.

File di folder ini adalah skeleton generik (tanpa logika bisnis BARI: prisma/permission/impersonasi dilepas) — acuan struktur & desain.

## Konvensi library (WAJIB diikuti saat generate)
Template React/Next ini memakai:
- **Tabel:** `@tanstack/react-table` — https://tanstack.com/table (headless; render pakai komponen shadcn `Table`). `npm i @tanstack/react-table`.
- **Dropdown:** `react-select` — https://react-select.com (searchable/multi). `npm i react-select`. Di project shadcn boleh pakai Combobox (Popover + cmdk) sebagai alternatif.
- **Ikon:** `react-icons` — https://react-icons.github.io/react-icons/ (`import { FaUser } from "react-icons/fa"`). `lucide-react` tetap boleh untuk ikon bawaan komponen shadcn.
Jangan pakai DataTables/select2/FontAwesome di template React/Next.
