# Backend Knowledge Base (Solvatra)
Disuling dari roadmap.sh/backend. Pedoman praktis membangun backend andal, aman, dan skalabel.

## Languages
- Pilih sesuai konteks: Node.js/JS/TS (async I/O), Python (cepat dikembangkan), Go (konkurensi & performa), Java/C# (enterprise), PHP (web klasik/Laravel), Ruby, Rust (aman & cepat).
- Fokus: kuasai satu bahasa + ekosistemnya dalam-dalam sebelum melebar. Ikuti idiom & style bahasa itu.

## APIs
- REST: resource-oriented, gunakan metode & status code benar, versioning (/v1), pagination, filtering; dokumentasi OpenAPI.
- GraphQL: satu endpoint, klien pilih field; hati-hati N+1 (pakai dataloader) & query depth.
- gRPC: kontrak protobuf, performa tinggi, cocok antar-service internal. SOAP: legacy/enterprise.
- Prinsip: kontrak jelas, error konsisten (bentuk & kode), idempoten untuk PUT/DELETE, validasi input, rate limiting.

## Databases
- Relational (PostgreSQL/MySQL/MariaDB/SQL Server): skema, relasi, normalisasi (kurangi redundansi), transaksi & ACID.
- NoSQL: document (MongoDB), key-value (Redis/DynamoDB), wide-column (Cassandra), graph (Neo4j). Pilih sesuai pola akses.
- ORM: percepat kerja tapi pahami SQL yang dihasilkan; migrations untuk perubahan skema terkontrol.
- Kinerja: **indeks** kolom yang sering difilter/join; hindari **N+1** (eager load/join); profil query & baca query plan.
- Transaksi: jaga atomik (ACID), pahami isolation level & deadlock.

## Scaling Databases
- Replication (read replica) untuk baca berskala; sharding (partisi data) untuk tulis/volume besar.
- CAP theorem: konsistensi vs ketersediaan saat partisi — pilih sadar. Caching di depan DB untuk kurangi beban.
- Denormalisasi selektif & materialized view untuk baca berat.

## Caching
- Redis/Memcached untuk data panas (session, hasil query, rate limit). Tetapkan TTL & strategi invalidasi.
- Pola: cache-aside (lazy), write-through, write-behind. HTTP caching (Cache-Control, ETag) untuk respons.
- Waspada: stale data, thundering herd (pakai lock/single-flight), cache stampede.

## Authentication & Security
- AuthN: session-cookie (HttpOnly/Secure/SameSite) atau token (JWT); OAuth2/OpenID Connect untuk pihak ketiga; SAML enterprise.
- Password: **bcrypt/scrypt/argon2** (jangan MD5/SHA polos). Simpan hash, bukan plaintext.
- AuthZ: cek izin per-resource di server (RBAC/ABAC); jangan percaya klien.
- Wajib: HTTPS/TLS, validasi & sanitasi input, prepared statement (anti SQLi), CORS ketat, CSP, rate limit, kenali **OWASP Top 10**. Jangan bocorkan secret; pakai env/secret manager.

## Testing
- Unit (fungsi/logika), integration (DB/service), functional/E2E (alur API). Uji perilaku, bukan implementasi.
- Data uji terisolasi (test DB/fixtures), test cepat & deterministik, tambah regression test tiap bug.

## CI/CD
- Pipeline: lint → test → build → deploy otomatis dari Git. Env terpisah (dev/staging/prod), secret aman.
- Rilis aman: migrasi DB terkontrol, rollback, blue-green/canary, feature flag.

## Architecture
- Monolith (mulai di sini—sederhana) → microservices bila perlu skala/tim besar. SOA/service mesh untuk komunikasi antar-service.
- **Twelve-Factor App**: config di env, stateless process, log sebagai stream, dsb. Serverless untuk beban sporadis.
- Utamakan batas modul jelas & kopling rendah sebelum memecah jadi service.

## Message Brokers
- Kafka (log/stream throughput tinggi, event sourcing) & RabbitMQ (task queue, routing). Untuk decoupling & async.
- Pola: pub/sub, work queue; jaga idempotensi konsumen & dead-letter queue.

## Web Servers
- Nginx/Caddy/Apache sebagai reverse proxy, TLS termination, load balancing, static files, gzip/brotli, timeouts.

## Real-Time
- WebSocket (dua arah), Server-Sent Events (server→klien), long/short polling (fallback). Pilih sesuai kebutuhan latensi & arah data.
- Skala real-time: pub/sub (Redis) antar-instance, sticky session bila perlu.

## Building for Scale (Resiliency)
- Ketahanan: circuit breaker, retry + backoff, timeout, throttling, backpressure, graceful degradation, bulkhead.
- Stateless & horizontal scaling di belakang load balancer; idempotensi untuk aman di-retry.

## Observability
- Logging terstruktur, metrics (latency/error/throughput), tracing terdistribusi (OpenTelemetry). Instrumentasi + alerting.
- Pantau SLO/SLI; korelasikan log-metric-trace untuk debugging produksi.

## Containers & Orchestration
- Docker: image reproducible (multi-stage build, image kecil, non-root). Compose untuk lokal.
- Kubernetes: deployment, service, config/secret, autoscaling, health probe (liveness/readiness), resource limits.
