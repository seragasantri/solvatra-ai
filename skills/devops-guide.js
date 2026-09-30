// Skill: basis pengetahuan DevOps (disuling dari roadmap.sh/devops).
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Programming & Scripting", "Operating Systems & Terminal", "Version Control", "Networking & Protocols",
  "Web Servers & Load Balancing", "Containers", "Container Orchestration", "Cloud Providers", "Serverless",
  "Infrastructure as Code (Provisioning)", "Configuration Management", "CI/CD", "GitOps", "Secret Management",
  "Monitoring & Observability", "Service Mesh & Artifacts", "Cloud Design & Resiliency"];
const ALIASES = {
  scripting: "Programming & Scripting", bash: "Programming & Scripting", shell: "Programming & Scripting", python: "Programming & Scripting",
  os: "Operating Systems & Terminal", linux: "Operating Systems & Terminal", terminal: "Operating Systems & Terminal", unix: "Operating Systems & Terminal",
  git: "Version Control", vcs: "Version Control",
  network: "Networking & Protocols", networking: "Networking & Protocols", dns: "Networking & Protocols", tls: "Networking & Protocols", ssl: "Networking & Protocols", ssh: "Networking & Protocols", http: "Networking & Protocols",
  webserver: "Web Servers & Load Balancing", "web-server": "Web Servers & Load Balancing", nginx: "Web Servers & Load Balancing", loadbalancer: "Web Servers & Load Balancing", proxy: "Web Servers & Load Balancing",
  container: "Containers", containers: "Containers", docker: "Containers",
  orchestration: "Container Orchestration", kubernetes: "Container Orchestration", k8s: "Container Orchestration", ecs: "Container Orchestration", swarm: "Container Orchestration",
  cloud: "Cloud Providers", aws: "Cloud Providers", azure: "Cloud Providers", gcp: "Cloud Providers", iam: "Cloud Providers",
  serverless: "Serverless", lambda: "Serverless", functions: "Serverless",
  iac: "Infrastructure as Code (Provisioning)", terraform: "Infrastructure as Code (Provisioning)", pulumi: "Infrastructure as Code (Provisioning)", provisioning: "Infrastructure as Code (Provisioning)",
  config: "Configuration Management", ansible: "Configuration Management", "config-management": "Configuration Management", chef: "Configuration Management", puppet: "Configuration Management",
  cicd: "CI/CD", "ci/cd": "CI/CD", "ci-cd": "CI/CD", pipeline: "CI/CD", jenkins: "CI/CD",
  gitops: "GitOps", argocd: "GitOps", flux: "GitOps",
  secret: "Secret Management", secrets: "Secret Management", vault: "Secret Management",
  monitoring: "Monitoring & Observability", observability: "Monitoring & Observability", prometheus: "Monitoring & Observability", grafana: "Monitoring & Observability", logs: "Monitoring & Observability", tracing: "Monitoring & Observability",
  mesh: "Service Mesh & Artifacts", "service-mesh": "Service Mesh & Artifacts", istio: "Service Mesh & Artifacts", artifact: "Service Mesh & Artifacts",
  resiliency: "Cloud Design & Resiliency", "design-pattern": "Cloud Design & Resiliency", "disaster-recovery": "Cloud Design & Resiliency", ha: "Cloud Design & Resiliency",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "devops.md"), "utf8"); } catch { return ""; } }
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
  name: "devops_guide",
  description:
    "Basis pengetahuan DevOps: Linux/terminal, Git, jaringan & protokol, web server/load balancer, Docker, Kubernetes, cloud (AWS/Azure/GCP), serverless, Infrastructure as Code (Terraform), configuration management (Ansible), CI/CD, GitOps, secret management, monitoring/observability (Prometheus/Grafana/OpenTelemetry), service mesh, resiliency. Panggil untuk best-practice sebelum tugas infra/deploy/ops. topic: linux|network|docker|kubernetes|cloud|serverless|iac|config|cicd|gitops|secret|monitoring|mesh|resiliency|scripting|webserver|all; query opsional.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "linux, network, webserver, docker, kubernetes, cloud, serverless, iac, config, cicd, gitops, secret, monitoring, mesh, resiliency, scripting, atau all" },
      query: { type: "string", description: "Kata kunci opsional." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base devops belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: linux, network, docker, kubernetes, cloud, serverless, iac, config, cicd, gitops, secret, monitoring, mesh, resiliency, scripting, webserver, atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
