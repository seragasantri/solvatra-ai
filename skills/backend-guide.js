// Skill: basis pengetahuan Backend (disuling dari roadmap.sh/backend).
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Languages", "APIs", "Databases", "Scaling Databases", "Caching", "Authentication & Security",
  "Testing", "CI/CD", "Architecture", "Message Brokers", "Web Servers", "Real-Time",
  "Building for Scale (Resiliency)", "Observability", "Containers & Orchestration"];
const ALIASES = {
  language: "Languages", languages: "Languages", lang: "Languages",
  api: "APIs", apis: "APIs", rest: "APIs", graphql: "APIs", grpc: "APIs",
  db: "Databases", database: "Databases", databases: "Databases", sql: "Databases", nosql: "Databases", orm: "Databases", index: "Databases",
  scaling: "Scaling Databases", sharding: "Scaling Databases", replication: "Scaling Databases", cap: "Scaling Databases",
  cache: "Caching", caching: "Caching", redis: "Caching",
  auth: "Authentication & Security", authentication: "Authentication & Security", security: "Authentication & Security", jwt: "Authentication & Security", oauth: "Authentication & Security", owasp: "Authentication & Security",
  test: "Testing", testing: "Testing",
  cicd: "CI/CD", "ci/cd": "CI/CD", "ci-cd": "CI/CD", deploy: "CI/CD",
  architecture: "Architecture", microservices: "Architecture", monolith: "Architecture", serverless: "Architecture", "12factor": "Architecture",
  broker: "Message Brokers", "message-broker": "Message Brokers", kafka: "Message Brokers", rabbitmq: "Message Brokers", queue: "Message Brokers",
  "web-server": "Web Servers", webserver: "Web Servers", nginx: "Web Servers", proxy: "Web Servers",
  realtime: "Real-Time", "real-time": "Real-Time", websocket: "Real-Time", sse: "Real-Time",
  scale: "Building for Scale (Resiliency)", resiliency: "Building for Scale (Resiliency)", "circuit-breaker": "Building for Scale (Resiliency)",
  observability: "Observability", monitoring: "Observability", tracing: "Observability", logging: "Observability",
  docker: "Containers & Orchestration", kubernetes: "Containers & Orchestration", k8s: "Containers & Orchestration", container: "Containers & Orchestration",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "backend.md"), "utf8"); } catch { return ""; } }
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
  name: "backend_guide",
  description:
    "Basis pengetahuan Backend: bahasa, API (REST/GraphQL/gRPC), database & scaling, caching, auth & security, testing, CI/CD, arsitektur (microservices/serverless), message broker, web server, real-time, resiliency, observability, container/Kubernetes. Panggil untuk best-practice sebelum tugas backend/server/API/database. topic: api|db|auth|caching|scaling|architecture|testing|cicd|broker|realtime|observability|docker|languages|all; query opsional.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "api, db, auth, caching, scaling, architecture, testing, cicd, broker, web-server, realtime, scale, observability, docker, languages, atau all" },
      query: { type: "string", description: "Kata kunci opsional." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base backend belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: api, db, auth, caching, scaling, architecture, testing, cicd, broker, realtime, observability, docker, languages, atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
