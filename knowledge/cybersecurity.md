# Cyber Security Knowledge Base (Solvatra)
Disuling dari roadmap.sh/cyber-security. Fokus DEFENSIF & fondasional (blue team, hardening, awareness). Pengetahuan soal serangan dipakai untuk MEMPERTAHANKAN sistem milik/otorisasi sendiri — bukan menyerang pihak lain.

## Fundamentals & Learning Path
- Dasar IT: hardware, OS, jaringan, troubleshooting. Latih di lab legal (TryHackMe, HackTheBox, picoCTF, VulnHub) — bukan sistem orang lain.
- Sertifikasi jenjang: CompTIA Security+/Network+ (dasar), CEH/GSEC (menengah), OSCP/CISSP/CISM (lanjut).

## Operating Systems
- Kuasai Windows & Linux: GUI/CLI, permission, install software, CRUD file, log, troubleshooting.
- Hardening OS: minimalkan layanan, patch rutin, prinsip least-privilege, disable akun default, audit konfigurasi (CIS Benchmark).

## Networking
- OSI/TCP-IP, protokol & port umum (80/443/22/53/25...), SSL/TLS, subnetting/CIDR, NAT, VLAN, DMZ, VPN.
- Alat diagnosa: ping, dig/nslookup, traceroute, netstat/ss, nmap (port scan — hanya di jaringan sendiri), tcpdump/Wireshark (analisis paket).
- Segmentasi jaringan, firewall/ACL, dan protokol aman (SFTP, TLS, IPSEC, DNSSEC, LDAPS).

## Core Security Concepts
- CIA Triad (Confidentiality, Integrity, Availability). AAA: Authentication vs Authorization + Accounting.
- Defense in Depth, Zero Trust, least privilege, isolation/sandboxing, segmentation, perimeter vs DMZ.
- MFA/2FA, manajemen risiko, backup & resiliency, Blue/Red/Purple team, false positive/negative.

## Cryptography
- Hashing (SHA-256+, jangan MD5/SHA1 untuk keamanan) + salting untuk password; password pakai bcrypt/argon2.
- Simetris vs asimetris; public/private key; key exchange; PKI & sertifikat (X.509); TLS handshake.
- Enkripsi at-rest & in-transit; jangan bikin kripto sendiri — pakai library teruji.

## Threats & Attacks (awareness untuk bertahan)
- Social engineering: phishing/smishing/vishing/whaling, tailgating, dumpster diving, impersonation — mitigasi: pelatihan, verifikasi, MFA.
- Jaringan: DoS/DDoS, MITM, spoofing, DNS poisoning, evil twin/rogue AP — mitigasi: TLS, segmentasi, monitoring, rate limit.
- Web/app (OWASP Top 10): XSS, SQL injection, CSRF, directory traversal, buffer overflow — mitigasi: validasi/escape, prepared statement, token CSRF, patch.
- Kredensial: brute force/password spray, pass-the-hash — mitigasi: MFA, lockout, rate limit, password kuat/unik, deteksi anomali.
- Malware (virus/worm/trojan/ransomware) & APT/zero-day — mitigasi: EDR, patch, backup, least privilege, segmentation.

## Defense & Hardening
- Kontrol: firewall/NGFW, IDS/IPS (NIDS/HIPS), EDR/antivirus, DLP, ACL, host-based firewall, NAC.
- Hardening: patching, group policy, port blocking, jump server, endpoint security, honeypot/sinkhole, WPA2/WPA3 (bukan WEP).
- Prinsip: kurangi attack surface, default-deny, monitor & alert, segmentasi, backup teruji.

## Incident Response & Forensics
- Proses IR (NIST): Preparation → Identification → Containment → Eradication → Recovery → Lessons Learned.
- Log: event log, syslog, netflow, firewall log, packet capture — pusatkan (SIEM) & korelasikan.
- Forensik dasar: imaging (dd/FTK Imager), analisis (autopsy/winhex/memdump), jaga chain-of-custody. Threat hunting & OSINT.

## Frameworks & Standards
- MITRE ATT&CK (taktik/teknik), Cyber Kill Chain, Diamond Model.
- Standar: NIST CSF/RMF, ISO 27001, CIS Controls. SIEM & SOAR untuk deteksi & respons otomatis.

## Cloud Security
- Model: IaaS/PaaS/SaaS; public/private/hybrid. Shared responsibility model.
- Praktik: IAM least-privilege, enkripsi, jangan expose storage (S3 public!), IaC aman, logging (CloudTrail), patch & config audit.

## Programming for Security
- Python/Bash/PowerShell untuk otomasi (parsing log, scripting deteksi, tooling internal). Go/C++ untuk tooling & memahami eksploitasi memori.
- Tulis skrip aman & idempoten; simpan di VCS; jangan hardcode kredensial.

## Ethics & Rules of Engagement
- Uji keamanan HANYA pada sistem milik sendiri atau dengan izin tertulis (scope jelas). Patuhi hukum & aturan.
- Tujuan: temukan → laporkan → perbaiki (remediasi). Bukan menyerang atau merugikan pihak lain.
