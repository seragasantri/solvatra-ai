# DevOps Knowledge Base (Solvatra)
Disuling dari roadmap.sh/devops. Pedoman praktis: otomasi, infrastruktur, rilis, dan operasi yang andal & aman.

## Programming & Scripting
- Kuasai satu bahasa untuk otomasi: Python/Go/Node.js; scripting shell (Bash) & PowerShell untuk glue/ops.
- Tulis skrip idempoten, tangani error, log jelas; simpan di VCS. Hindari perintah destruktif tanpa konfirmasi.

## Operating Systems & Terminal
- Linux (Ubuntu/Debian/RHEL) dasar wajib: filesystem, permission (chmod/chown), proses (ps/top/htop), systemd/service, cron.
- Terminal: manipulasi teks (grep/sed/awk), monitoring (top/vmstat/iostat), jaringan (ss/netstat/curl/dig/traceroute), editor (vim/nano).

## Version Control
- Git: branch, commit kecil bermakna, PR + review, tag rilis. Host: GitHub/GitLab/Bitbucket. Jangan commit secret.

## Networking & Protocols
- OSI/TCP-IP dasar; HTTP/HTTPS, DNS (A/CNAME/MX/TXT), SSL/TLS (sertifikat, handshake), SSH (kunci, hardening).
- Email: SMTP/IMAP/POP3 + SPF/DKIM/DMARC. Firewall, proxy (forward/reverse), NAT.

## Web Servers & Load Balancing
- Nginx/Caddy/Apache: reverse proxy, TLS termination, static, gzip/brotli, timeout, rate limit.
- Load balancer (L4/L7), health check, sticky session; caching server (Varnish/CDN) di depan aplikasi.

## Containers
- Docker: image reproducible (multi-stage, kecil, non-root, pin versi), .dockerignore, layer caching, health check.
- Registry untuk image; scan kerentanan image; jangan taruh secret di image.

## Container Orchestration
- Kubernetes: Pod/Deployment/Service/Ingress, ConfigMap/Secret, resource requests/limits, probes (liveness/readiness), HPA autoscaling, namespaces.
- Alternatif terkelola: EKS/GKE/AKS, ECS/Fargate, Docker Swarm. Rolling update & rollback.

## Cloud Providers
- AWS/Azure/GCP (juga DigitalOcean/Hetzner). Konsep: compute, storage (object/block), networking (VPC), IAM (least privilege), managed DB.
- Prinsip: least-privilege IAM, tagging, multi-AZ untuk ketersediaan, biaya terpantau.

## Serverless
- AWS Lambda / Azure Functions / GCP Functions / Vercel / Cloudflare Workers. Untuk beban event-driven/sporadis.
- Perhatikan cold start, timeout, statelessness, dan batas ukuran.

## Infrastructure as Code (Provisioning)
- Terraform (multi-cloud, deklaratif), Pulumi (bahasa umum), CloudFormation/CDK (AWS). Simpan state aman (remote backend + lock).
- Prinsip: deklaratif, reproducible, review perubahan (plan), modular, jangan ubah infra manual (drift).

## Configuration Management
- Ansible (agentless, YAML), Chef/Puppet/Salt. Untuk konfigurasi server konsisten & idempoten.
- Utamakan idempotensi & inventori terkontrol; makin ke arah immutable infra (bakar image, bukan patch manual).

## CI/CD
- Pipeline: build → test → scan → deploy otomatis (GitHub Actions/GitLab CI/Jenkins/CircleCI).
- Rilis aman: environment terpisah, secret aman, artifact ter-versioning, blue-green/canary, rollback, feature flag.

## GitOps
- Sumber kebenaran = Git; ArgoCD/FluxCD men-sinkronkan cluster ke manifest di repo. Perubahan lewat PR → audit & rollback mudah.

## Secret Management
- Jangan hardcode/commit secret. Vault/Sealed Secrets/SOPS/cloud KMS. Rotasi berkala, akses least-privilege, enkripsi at-rest & in-transit.

## Monitoring & Observability
- Metrics: Prometheus + Grafana (dashboard, alert), Datadog/Zabbix. The 4 golden signals: latency, traffic, errors, saturation.
- Logs: Elastic Stack/Loki/Graylog/Splunk (terstruktur, terpusat). Tracing: OpenTelemetry/Jaeger.
- Tetapkan SLO/SLI, alert bermakna (bukan noise), korelasi log-metric-trace.

## Service Mesh & Artifacts
- Service mesh (Istio/Linkerd/Consul/Envoy): mTLS, traffic routing, observability antar-service.
- Artifact repo (Artifactory/Nexus): simpan image/paket ter-versioning & terpercaya.

## Cloud Design & Resiliency
- Pola: redundansi multi-AZ, auto-scaling, health check + self-healing, circuit breaker, retry+backoff, graceful degradation.
- Backup & disaster recovery (RPO/RTO), infrastruktur immutable, dan uji failover.
