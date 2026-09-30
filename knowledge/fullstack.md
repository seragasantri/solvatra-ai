# Full-Stack Knowledge Base (Solvatra)
Disuling dari roadmap.sh/full-stack. Fokus: membangun aplikasi UTUH end-to-end dan menyambungkan semua lapisan. Untuk detail tiap bidang, pakai frontend_guide / backend_guide / devops_guide / datascience_guide.

## Overview & Mindset
- Full-stack = mampu mengerjakan dari UI sampai server, database, dan deployment. Kuncinya bukan tahu semua tool, tapi memahami bagaimana lapisan saling terhubung dan trade-off-nya.
- Alur nilai: UI (frontend) → API (backend) → data (database) → dirilis & dipantau (DevOps). Pikirkan kontrak antar-lapisan (bentuk data, error, auth) sejak awal.
- Bangun tipis dulu end-to-end (vertical slice: satu fitur dari UI sampai DB) baru lebarkan — daripada menyempurnakan satu lapisan sendirian.

## Recommended Stack (modern, praktis)
- Frontend: HTML/CSS + Tailwind + React (Next.js untuk SSR/routing) atau Vue/SvelteKit; TypeScript.
- Backend: Node.js (Express/Fastify/NestJS) atau bahasa pilihan (Go/Python/PHP-Laravel); REST atau GraphQL.
- Database: PostgreSQL (relational) + Redis (cache/session/queue). ORM (Prisma/Drizzle/TypeORM) + migrations.
- Ops: Docker, GitHub Actions (CI/CD), cloud (AWS/Vercel/Railway), IaC (Terraform), monitoring (Prometheus/Grafana atau layanan).
- Pilih satu set, kuasai, dan bangun banyak proyek — konsistensi > mengejar tool baru.

## End-to-End App Flow
1. Rancang data & kontrak API dulu (entity, endpoint, bentuk request/response, error).
2. Backend: model DB + migrations → endpoint CRUD + validasi + auth.
3. Frontend: komponen + state + panggil API (fetch/react-query) + tangani loading/error.
4. Sambungkan: CORS benar, env untuk base URL, tipe bersama (kalau TS) agar FE-BE sinkron.
5. Rilis: containerize → CI/CD → deploy → monitoring & log. Iterasi per fitur.

## Frontend ↔ Backend Integration
- Kontrak jelas: dokumentasikan endpoint (OpenAPI) & bentuk data; validasi di kedua sisi (klien untuk UX, server untuk keamanan).
- Data fetching: gunakan lib (react-query/SWR) untuk caching, retry, loading/error state; hindari state global berlebihan.
- Error handling seragam: format error konsisten dari API → tampilkan ramah di UI. Tangani status (401→login, 403, 422 validasi, 5xx).
- CORS & env: atur origin diizinkan di server; base URL API lewat env, bukan hardcode.

## Auth End-to-End
- Alur: login → server verifikasi (password hash bcrypt) → keluarkan session-cookie (HttpOnly/Secure/SameSite) atau JWT.
- Simpan token aman (hindari localStorage untuk token sensitif). Kirim di header/cookie; server memvalidasi tiap request.
- Otorisasi per-resource di server (jangan andalkan sembunyikan tombol di UI). Refresh token & logout benar. OAuth/OIDC untuk login pihak ketiga.

## Data Layer
- PostgreSQL: skema ternormalisasi, indeks untuk query sering, transaksi untuk operasi atomik, migrations terkontrol.
- Redis: cache hasil mahal (cache-aside + TTL), session store, rate limiting, queue ringan.
- Cegah N+1 (eager load/join), hindari data leakage, backup rutin.

## Deployment & Ops
- Containerize (Docker multi-stage, image kecil, non-root). Env/secret lewat secret manager, bukan di repo.
- CI/CD (GitHub Actions): lint → test → build → deploy; migrasi DB terkontrol; rollback/canary.
- Cloud dasar (AWS): EC2/compute, S3 (storage), RDS (DB terkelola), Route53 (DNS), VPC (jaringan), IAM least-privilege. Alternatif cepat: Vercel/Railway/Render.
- Monitoring & log terpusat + alert; health check & auto-restart.

## Learning Path (checkpoints)
Static page → interaktif (JS) → pakai package (npm) → kolaborasi (Git/GitHub) → app frontend (React) → CLI/Node → CRUD API (REST) → app lengkap (auth+DB) → deploy → monitoring → CI/CD → automation/IaC. Bangun proyek nyata di tiap checkpoint.

## Cross-cutting Concerns
- Keamanan di semua lapisan (validasi, escape, prepared statement, HTTPS, secret aman) — lihat cyber_security.
- Performa (caching, indeks, lazy-load, bundle) & aksesibilitas di UI.
- Testing (unit/integration/e2e) & observability sejak awal, bukan belakangan.
