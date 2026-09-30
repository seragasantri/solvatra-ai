// Skill: basis pengetahuan Full-Stack (disuling dari roadmap.sh/full-stack).
// Fokus integrasi end-to-end; rujuk frontend_guide/backend_guide/devops_guide untuk detail.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Overview & Mindset", "Recommended Stack", "End-to-End App Flow", "Frontend ↔ Backend Integration",
  "Auth End-to-End", "Data Layer", "Deployment & Ops", "Learning Path", "Cross-cutting Concerns"];
const ALIASES = {
  overview: "Overview & Mindset", mindset: "Overview & Mindset",
  stack: "Recommended Stack", "recommended-stack": "Recommended Stack",
  flow: "End-to-End App Flow", "end-to-end": "End-to-End App Flow", e2e: "End-to-End App Flow",
  integration: "Frontend ↔ Backend Integration", "fe-be": "Frontend ↔ Backend Integration", api: "Frontend ↔ Backend Integration",
  auth: "Auth End-to-End", login: "Auth End-to-End",
  data: "Data Layer", database: "Data Layer", db: "Data Layer",
  deploy: "Deployment & Ops", deployment: "Deployment & Ops", ops: "Deployment & Ops",
  path: "Learning Path", roadmap: "Learning Path", checkpoint: "Learning Path",
  crosscutting: "Cross-cutting Concerns", security: "Cross-cutting Concerns", performance: "Cross-cutting Concerns",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "fullstack.md"), "utf8"); } catch { return ""; } }
function extractSection(doc, title) {
  const lines = doc.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("## ") && lines[i].slice(3).trim().startsWith(title)) { start = i; break; }
  }
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (lines[i].startsWith("## ")) { end = i; break; } }
  return lines.slice(start, end).join("\n").trim();
}

export default {
  name: "fullstack_guide",
  description:
    "Basis pengetahuan Full-Stack: membangun aplikasi UTUH end-to-end & menyambungkan lapisan (UI → API → DB → deploy). Panggil untuk tugas full-stack/aplikasi lengkap/arsitektur end-to-end. topic: overview|stack|flow|integration|auth|data|deploy|path|crosscutting|all; query opsional. Untuk detail per bidang pakai frontend_guide/backend_guide/devops_guide.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "overview, stack, flow, integration, auth, data, deploy, path, crosscutting, atau all" },
      query: { type: "string", description: "Kata kunci opsional." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base full-stack belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: overview, stack, flow, integration, auth, data, deploy, path, crosscutting, atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
