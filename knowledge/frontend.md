# Frontend Knowledge Base (Solvatra)
Disuling dari roadmap.sh/frontend. Prinsip praktis untuk HTML, CSS, JavaScript, PHP + Accessibility, Performance, Security. Terapkan saat membangun/menilai frontend.

## HTML
- Pakai HTML **semantik**: `header, nav, main, section, article, aside, footer`, heading berjenjang (`h1`→`h6`, satu `h1` per halaman). Jangan `div` untuk segalanya.
- Selalu: `<!DOCTYPE html>`, `<html lang="id">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>` deskriptif.
- Form: setiap input punya `<label for>`; pakai `type` yang tepat (`email`, `tel`, `number`, `date`), `required`, `autocomplete`, `name`. Kelompokkan dengan `<fieldset>/<legend>`. Tombol submit `<button type="submit">`.
- Gambar: `alt` bermakna (kosong `alt=""` untuk dekoratif), `width`/`height` untuk cegah layout shift, `loading="lazy"` untuk yang di bawah lipatan.
- Tautan `<a href>` untuk navigasi, `<button>` untuk aksi — jangan tukar.
- SEO/meta: `meta description`, Open Graph (`og:title/description/image`), heading rapi, URL bermakna.
- Hindari: tabel untuk layout, inline style berlebihan, `<br>` untuk spasi, atribut usang (`align`, `bgcolor`).

## CSS
- **Layout modern**: Flexbox untuk 1 dimensi, **Grid** untuk 2 dimensi. Hindari `float` untuk layout.
- **Responsif**: mobile-first, `min-width` media queries, unit relatif (`rem`, `%`, `vw/vh`, `clamp()`), gambar `max-width:100%`. Uji di lebar ponsel.
- **Custom properties** (`--token`) untuk warna/spacing/tema; dukung dark mode via `prefers-color-scheme` atau class `.dark`.
- **Box model**: set `box-sizing: border-box` global. Gunakan `gap` (bukan margin) di fl-ex/grid.
- Spesifisitas rendah & konsisten: satu metodologi (utility seperti Tailwind, atau BEM). Hindari `!important` kecuali darurat.
- Aksesibilitas visual: kontras cukup (WCAG AA ≥ 4.5:1 teks), `:focus-visible` terlihat, jangan hanya andalkan warna.
- Performa: minim reflow, animasikan `transform`/`opacity` (bukan `top/left/width`), `will-change` seperlunya, hindari selector super dalam.

## JavaScript
- **Modern ES**: `const`/`let` (bukan `var`), arrow fn, template literals, destructuring, modules (`import/export`), optional chaining `?.`, nullish `??`.
- **DOM**: `querySelector`/`addEventListener`; delegasi event untuk daftar dinamis; hindari `innerHTML` dgn input user (XSS) — pakai `textContent` atau sanitasi.
- **Async**: `async/await` + `try/catch`; `fetch` dengan cek `res.ok`; `Promise.all` untuk paralel; `AbortController` untuk timeout/cancel.
- **State/render**: jaga sumber kebenaran tunggal; render dari state; hindari manipulasi DOM tersebar. Untuk app kompleks pakai framework (React/Vue/Svelte).
- **Kualitas**: fungsi kecil & murni bila bisa, penamaan jelas, hindari global, tangani error & loading state. Lint (ESLint) + format (Prettier).
- **Performa**: debounce/throttle event sering (scroll/resize/input); `IntersectionObserver` untuk lazy; jangan blok main thread (pecah kerja berat / Web Worker); bundle & code-split (Vite).
- **Keamanan klien**: jangan simpan rahasia di JS; validasi ulang di server; hati-hati `eval`, `innerHTML`, URL dari user.

## PHP (server-rendered frontend)
- Pakai PHP modern (8+): tipe argumen/return, `match`, null-safe `?->`. Pisahkan logika dari tampilan (template).
- **XSS**: SELALU escape output ke HTML dengan `htmlspecialchars($v, ENT_QUOTES, 'UTF-8')`. Jangan echo input mentah.
- **SQL injection**: pakai **prepared statements** (PDO/mysqli) dengan parameter terikat — jangan konkatenasi input ke query.
- **CSRF**: token per-form (`hash_equals` untuk verifikasi); cek metode (`$_SERVER['REQUEST_METHOD']`).
- **Session/Auth**: `session_regenerate_id(true)` saat login; cookie `HttpOnly`, `Secure`, `SameSite`; password dengan `password_hash`/`password_verify` (bcrypt/argon2).
- **Validasi input**: `filter_input`/`filter_var`, whitelist nilai; jangan percaya `$_GET/$_POST/$_COOKIE`.
- **Upload**: cek MIME & ekstensi (whitelist), simpan di luar webroot, jangan pakai nama asli.
- Template: gunakan engine (Blade/Twig) yang auto-escape; kalau PHP polos, escape manual tiap output.

## Accessibility (a11y)
- Struktur semantik + landmark; urutan tab logis; semua fungsi bisa via keyboard.
- Label untuk kontrol; `aria-*` hanya bila HTML semantik tak cukup (jangan berlebihan).
- Kontras warna cukup; jangan hanya warna sebagai penanda; `:focus-visible` jelas.
- Gambar `alt`; video punya caption; hormati `prefers-reduced-motion`.
- Uji: navigasi keyboard, screen reader, Lighthouse/axe.

## Performance
- Kirim aset minimal: minify, gzip/brotli, code-split, tree-shake; lazy-load gambar/komponen.
- `Cache-Control` untuk aset statis; CDN; hindari render-blocking (defer JS, preload font penting).
- Cegah layout shift (CLS): dimensi gambar/embed; font-display swap.
- Ukur: Lighthouse, Core Web Vitals (LCP/CLS/INP), DevTools Performance.

## Web Security (frontend)
- **HTTPS** wajib; **CORS** dibatasi origin tepercaya (bukan `*` untuk kredensial).
- **CSP** untuk batasi sumber script; hindari inline script bila bisa.
- Kenali **OWASP**: XSS, CSRF, injection, insecure deserialization, auth lemah.
- Jangan taruh secret di kode klien; validasi & otorisasi selalu di server.

## Web Fundamentals
- Internet & HTTP: request/response, metode (GET/POST/PUT/PATCH/DELETE), status code (2xx/3xx/4xx/5xx), header, HTTPS/TLS.
- DNS memetakan domain → IP; browser me-resolve DNS lalu render (parse HTML→DOM, CSS→CSSOM, layout, paint).
- Hosting/CDN: aset statis dekat user; cache & TTL. Pahami CORS, cookie, dan caching.
- Rendering pipeline browser: kritikal path — minim render-blocking; defer/async script.

## Version Control (Git)
- Alur: `clone/init` → branch → commit kecil bermakna → push → pull request → review → merge.
- Perintah inti: `status`, `add -p`, `commit -m`, `switch -c`, `rebase`/`merge`, `stash`, `log --oneline`.
- Commit message jelas (imperatif). `.gitignore` untuk artefak (node_modules, .env, dist). Jangan commit rahasia.
- Hosting: GitHub/GitLab. PR kecil, deskripsi jelas, CI lulus sebelum merge.

## Package Managers
- npm (default), pnpm (cepat, hemat disk via symlink), yarn, bun (all-in-one cepat). Pilih satu per proyek; commit lockfile.
- `install` (reproducible: `npm ci`), `run <script>`, semantic versioning (^ minor, ~ patch). Audit: `npm audit`.

## TypeScript
- Superset JS bertipe → tangkap bug saat compile. Aktifkan `strict: true`.
- Ketik props/params/return; hindari `any` (pakai `unknown` + narrowing). Manfaatkan union, generics, `interface`/`type`, utility types (`Partial`, `Pick`, `Record`).
- Untuk data eksternal (API): validasi runtime (mis. zod) + tipe turunan; jangan percaya bentuk data mentah.

## JavaScript Frameworks
- Pilih sesuai kebutuhan: **React** (ekosistem besar, Next.js), **Vue** (ramah, Nuxt), **Svelte** (ringkas, SvelteKit), **Angular** (opinionated, enterprise), **Solid** (reaktivitas granular).
- Konsep umum: komponen, props, state, lifecycle/effects, conditional & list render (pakai `key` stabil), lifting state, context/store.
- Praktik: komponen kecil & fokus, state minimal & satu sumber kebenaran, hindari efek samping tak perlu, derive state daripada duplikat.
- React spesifik: hooks (`useState/useEffect/useMemo/useCallback`), dependency array benar, jangan mutasi state, key stabil, hindari render mahal.

## CSS Frameworks
- **Tailwind** (utility-first): styling di markup, konsisten via token, purge kelas tak terpakai. Cocok dengan komponen.
- Alternatif: Bootstrap (komponen siap), UnoCSS. Untuk React/Vue: shadcn/ui (Radix+Tailwind), PrimeVue, dsb.
- Konsistenkan design token (warna/spacing/radius) di config framework.

## Build Tools
- **Vite** (dev cepat via ESM + HMR, build via Rollup) — default modern. Alternatif: esbuild, Rollup, Parcel, Turbopack.
- **Linter**: ESLint (atau Biome) untuk tangkap error/gaya. **Formatter**: Prettier (atau Biome). Jalankan di pre-commit/CI.
- Code-splitting, tree-shaking, minify, asset hashing otomatis di build produksi.

## Testing
- **Unit/Component**: Vitest atau Jest — uji fungsi & komponen (React Testing Library) dari sisi perilaku user, bukan detail implementasi.
- **E2E**: Playwright atau Cypress — alur nyata di browser.
- Prinsip: uji perilaku yang penting, jaga test cepat & deterministik, hindari over-mocking, tambah regression test saat fix bug.

## Web Components
- Standar native: **Custom Elements** (`customElements.define`), **Shadow DOM** (enkapsulasi style/DOM), **HTML Templates** (`<template>`/`<slot>`).
- Cocok untuk komponen lintas-framework/reusable. Perhatikan styling (shadow boundary) & aksesibilitas.

## Rendering (CSR/SSR/SSG/ISR)
- **CSR**: render di browser (SPA) — interaktif, tapi TTFB konten lambat & kurang SEO.
- **SSR**: render di server tiap request (Next.js/Nuxt/SvelteKit) — SEO & first paint baik.
- **SSG**: pra-render saat build (Astro/Next/Eleventy) — cepat, untuk konten statis.
- **ISR/hybrid**: gabungan; pilih per-halaman sesuai kebutuhan SEO/kesegaran data.

## PWA
- `manifest.json` (nama, ikon, theme) + **Service Worker** (cache offline, strategi cache-first/network-first) → installable & offline.
- Hati-hati versioning cache SW; hormati update. HTTPS wajib.

## Web APIs
- DOM, Fetch, Storage (`localStorage`/`sessionStorage`/IndexedDB), History/Router, `IntersectionObserver`, `ResizeObserver`, Web Workers, Geolocation, Clipboard, Notifications, WebSocket.
- Pilih API tepat: observer untuk visibilitas/ukuran (bukan polling), Worker untuk kerja berat, IndexedDB untuk data besar terstruktur.

## Auth Strategies
- Session cookie (server-side, `HttpOnly`+`Secure`+`SameSite`) atau token (JWT) — pahami trade-off. OAuth2/OIDC untuk login pihak ketiga.
- Simpan token dengan aman (hindari `localStorage` untuk token sensitif → rentan XSS). Selalu otorisasi di server. Refresh token & logout benar.

## Deployment
- Static/SPA: Vercel, Netlify, Cloudflare Pages, GitHub Pages. Full-stack/SSR: Vercel, Railway, Render.
- Otomatis dari Git (build on push), env var untuk rahasia, preview deploy per-PR, atur cache header aset.

## Design Systems
- Kumpulan token (warna/tipografi/spacing/radius) + komponen konsisten + pedoman. Sumber kebenaran tunggal untuk UI.
- Manfaat: konsistensi, kecepatan, aksesibilitas terjaga. Dokumentasikan (mis. Storybook).
