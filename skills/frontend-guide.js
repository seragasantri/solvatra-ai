// Skill: basis pengetahuan frontend (HTML/CSS/JS/PHP + a11y/perf/security) hasil "pelatihan"
// dari roadmap.sh/frontend. Agent memanggilnya untuk best-practice sebelum ngoding frontend.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

// Peta kata kunci -> judul section di knowledge/frontend.md
const SECTIONS = ["HTML", "CSS", "JavaScript", "PHP", "Accessibility", "Performance", "Web Security",
  "Web Fundamentals", "Version Control", "Package Managers", "TypeScript", "JavaScript Frameworks",
  "CSS Frameworks", "Build Tools", "Testing", "Web Components", "Rendering", "PWA", "Web APIs",
  "Auth Strategies", "Deployment", "Design Systems"];
const ALIASES = {
  html: "HTML", css: "CSS", js: "JavaScript", javascript: "JavaScript", php: "PHP",
  a11y: "Accessibility", accessibility: "Accessibility", perf: "Performance", performance: "Performance",
  security: "Web Security", keamanan: "Web Security",
  internet: "Web Fundamentals", web: "Web Fundamentals", fundamentals: "Web Fundamentals", http: "Web Fundamentals",
  git: "Version Control", vcs: "Version Control", version: "Version Control",
  npm: "Package Managers", package: "Package Managers", "package-manager": "Package Managers",
  ts: "TypeScript", typescript: "TypeScript",
  framework: "JavaScript Frameworks", frameworks: "JavaScript Frameworks", react: "JavaScript Frameworks",
  vue: "JavaScript Frameworks", angular: "JavaScript Frameworks", svelte: "JavaScript Frameworks", solid: "JavaScript Frameworks",
  tailwind: "CSS Frameworks", "css-framework": "CSS Frameworks", bootstrap: "CSS Frameworks",
  build: "Build Tools", bundler: "Build Tools", vite: "Build Tools", eslint: "Build Tools", prettier: "Build Tools", lint: "Build Tools",
  test: "Testing", testing: "Testing",
  "web-components": "Web Components", webcomponents: "Web Components", "web-component": "Web Components",
  ssr: "Rendering", ssg: "Rendering", csr: "Rendering", isr: "Rendering", rendering: "Rendering",
  pwa: "PWA",
  "web-api": "Web APIs", webapi: "Web APIs", webapis: "Web APIs", api: "Web APIs",
  auth: "Auth Strategies", authentication: "Auth Strategies", login: "Auth Strategies",
  deploy: "Deployment", deployment: "Deployment", hosting: "Deployment",
  "design-system": "Design Systems", designsystem: "Design Systems", "design-systems": "Design Systems" };

function loadDoc() {
  try { return fs.readFileSync(path.join(config.knowledgeDir, "frontend.md"), "utf8"); } catch { return ""; }
}
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
  name: "frontend_guide",
  description:
    "Basis pengetahuan best-practice frontend (HTML, CSS, JavaScript, PHP, Accessibility, Performance, Web Security). Panggil untuk mengambil pedoman sebelum membuat/menilai kode frontend. topic mencakup seluruh roadmap frontend: html, css, js, php, typescript, frameworks, tailwind, build, testing, web-components, rendering(ssr/ssg), pwa, web-api, auth, deployment, design-system, git, package, fundamentals, accessibility, performance, security, atau all. query opsional untuk mencari kata kunci.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "html|css|js|php|accessibility|performance|security|all (default all)" },
      query: { type: "string", description: "Kata kunci opsional untuk mencari baris relevan." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base frontend belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();

    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: html, css, js, php, accessibility, performance, security, all.`;
    }

    if (input.query) {
      const q = input.query.toLowerCase();
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(q));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
