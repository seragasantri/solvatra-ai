// Skill: playbook kerja (cara kerja tepat, debugging, frontend, backend, devops/deploy,
// github, code review, review keamanan, tes, commit/PR, artikel, narasi, copywriting,
// ringkasan). Langkah praktis + checklist + jebakan umum.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const TOPICS = {
  "cara-kerja": "cara-kerja", akurasi: "cara-kerja", ketepatan: "cara-kerja", umum: "cara-kerja",
  debugging: "debugging", debug: "debugging", error: "debugging",
  frontend: "frontend", ui: "frontend", react: "frontend",
  backend: "backend", api: "backend", laravel: "backend", database: "backend",
  devops: "devops-deploy", deploy: "devops-deploy", nginx: "devops-deploy", server: "devops-deploy", docker: "devops-deploy",
  github: "github", git: "github", pr: "github",
  "code-review": "code-review", review: "code-review",
  "security-review": "security-review", security: "security-review", keamanan: "security-review",
  tes: "tes", test: "tes", testing: "tes", unit: "tes", e2e: "tes",
  "commit-pr": "commit-pr", commit: "commit-pr", "pull-request": "commit-pr",
  artikel: "artikel", seo: "artikel", blog: "artikel",
  narasi: "narasi", cerita: "narasi", naskah: "narasi",
  copywriting: "copywriting", iklan: "copywriting", caption: "copywriting", email: "copywriting",
  ringkasan: "ringkasan", notulen: "ringkasan", rangkuman: "ringkasan",
};

const ALL_KEYS = ["cara-kerja", "debugging", "frontend", "backend", "devops", "github", "code-review", "security-review",
  "tes", "commit-pr", "artikel", "narasi", "copywriting", "ringkasan"];
const dir = () => path.join(config.knowledgeDir, "playbooks");

export default {
  name: "playbook",
  description:
    "Ambil playbook kerja (langkah praktis + checklist + jebakan umum) SEBELUM mengerjakan tugas di bidangnya. " +
    "topic: cara-kerja (wajib untuk tugas perbaikan/implementasi), debugging, frontend, backend, devops (deploy/nginx/systemd/docker), github, code-review, security-review, " +
    "tes (unit/integrasi/e2e), commit-pr (pesan commit & deskripsi PR), artikel (blog & SEO), narasi (cerita & naskah), copywriting (iklan/caption/email/landing), ringkasan (dokumen & notulen).",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", enum: ALL_KEYS },
    },
    required: ["topic"],
  },
  async run(input) {
    const key = TOPICS[String(input.topic || "").toLowerCase()];
    if (!key) return `Topic tidak dikenal. Pilih: ${[...new Set(Object.values(TOPICS))].join(", ")}.`;
    try { return fs.readFileSync(path.join(dir(), `${key}.md`), "utf8"); }
    catch { return `Playbook ${key} belum tersedia.`; }
  },
};
