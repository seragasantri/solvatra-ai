# AI Red Teaming Knowledge Base (Solvatra)
Disuling dari roadmap.sh/ai-red-teaming. Tujuan: MENGUJI & MEMPERKUAT keamanan sistem AI (LLM/agent) milik/di bawah otorisasi sendiri — memahami kelemahan untuk MEMPERBAIKINYA. Fokus konsep, deteksi, dan mitigasi; bukan resep serangan siap-pakai untuk menyerang sistem pihak lain.

## Introduction & Ethics
- AI red teaming = evaluasi adversarial terhadap sistem AI untuk menemukan & menutup celah sebelum disalahgunakan. Peran red team: mensimulasikan penyerang secara sah untuk meningkatkan pertahanan.
- WAJIB: otorisasi tertulis & scope jelas, kepatuhan hukum, minimalkan dampak, dan **responsible disclosure** (laporkan ke pemilik, beri waktu perbaikan). Uji hanya sistem sendiri/berizin.

## AI/ML Foundations
- Paradigma: supervised, unsupervised, reinforcement learning; neural network; generative models; LLM & cara kerja (token, konteks, sampling).
- Prompt engineering: memahami bagaimana input membentuk output — dasar untuk menilai perilaku & batas model.

## AI Security Concepts
- CIA untuk AI: kerahasiaan (data/model), integritas (output & bobot), ketersediaan (layanan inferensi).
- Threat modeling (aset, aktor, jalur serangan), manajemen risiko, dan vulnerability assessment khusus sistem AI/agent.

## Prompt Hacking (konsep & mitigasi)
- Prompt injection: **direct** (input user berisi instruksi jahat) & **indirect** (instruksi tersembunyi di konten eksternal yang dibaca model — web/dokumen/tool output). Jailbreak & safety-filter bypass = upaya membuat model mengabaikan kebijakan.
- Mitigasi (yang penting): perlakukan konten eksternal sebagai DATA bukan perintah; pisahkan instruksi sistem dari data; validasi & batasi output; least-privilege pada tool; guardrail input/output; deteksi anomali; jangan pernah taruh rahasia di prompt. (Solvatra sendiri menerapkan pemisahan data-vs-perintah ini.)

## Model Vulnerabilities & Defenses
- Ancaman: model extraction / weight stealing, unauthorized access, data poisoning (racuni data latih), adversarial examples (input yang menipu model), model inversion (bocorkan data latih).
- Pertahanan: adversarial training, robust model design, rate limiting & auth ketat pada API, deteksi query anomali, privacy (DP), continuous monitoring, kontrol akses ke bobot/artefak model.

## Infrastructure Security
- Amankan pipeline & serving: autentikasi & otorisasi API, hindari insecure deserialization & RCE, sandbox eksekusi (kode/tool), scan dependency & artefak model, secret management.
- Prinsip: least-privilege, isolasi, patch, logging — sama seperti keamanan aplikasi umum, ditambah risiko khas ML.

## Testing Methodology
- Pendekatan: black-box (tanpa akses internal), white-box (akses penuh), grey-box (sebagian). Kombinasi automated + manual, dan continuous testing.
- Gunakan benchmark/dataset uji, skrip uji khusus, platform pengujian, dan pantau hasil. Dokumentasikan temuan dengan bukti & tingkat keparahan.

## Defense Strategies
- Berlapis: guardrail (input/output filter), pembatasan tool & izin (least-privilege), validasi keluaran, human-in-the-loop untuk aksi berdampak, monitoring & alerting, red-team berkala.
- Untuk LLM app: pisahkan konteks tepercaya vs tidak; batasi kemampuan; audit prompt & kebijakan; uji regresi keamanan.

## Agentic AI Security
- Agent (yang memakai tool/eksekusi) memperluas attack surface: prompt injection bisa memicu aksi berbahaya via tool. Amankan dengan: izin tool minimal, konfirmasi/mode untuk aksi berdampak, sandbox, validasi argumen tool, dan perlakukan output tool/eksternal sebagai data.
- Contoh penerapan (Solvatra): mode approval (ask/auto/manual), konfirmasi aksi berdampak, guardrail konten eksternal.

## Practice, Community & Growth
- Latihan di lab legal & CTF (khusus AI security), sertifikasi/kursus spesialis, ikut riset & komunitas, pantau emerging threats & industry standards.
- Selalu utamakan etika: temukan → laporkan bertanggung jawab → bantu perbaiki.
