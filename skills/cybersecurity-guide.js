// Skill: basis pengetahuan Cyber Security (disuling dari roadmap.sh/cyber-security).
// Defensif/edukatif. Berbeda dari skill "cyber_security" (scanner audit kode).
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Fundamentals & Learning Path", "Operating Systems", "Networking", "Core Security Concepts",
  "Cryptography", "Threats & Attacks", "Defense & Hardening", "Incident Response & Forensics",
  "Frameworks & Standards", "Cloud Security", "Programming for Security", "Ethics & Rules of Engagement"];
const ALIASES = {
  fundamentals: "Fundamentals & Learning Path", basics: "Fundamentals & Learning Path", cert: "Fundamentals & Learning Path", ctf: "Fundamentals & Learning Path",
  os: "Operating Systems", hardening: "Defense & Hardening", "os-hardening": "Operating Systems",
  network: "Networking", networking: "Networking", nmap: "Networking", ports: "Networking",
  concepts: "Core Security Concepts", cia: "Core Security Concepts", "zero-trust": "Core Security Concepts", mfa: "Core Security Concepts", aaa: "Core Security Concepts",
  crypto: "Cryptography", cryptography: "Cryptography", hashing: "Cryptography", pki: "Cryptography", tls: "Cryptography",
  threats: "Threats & Attacks", attacks: "Threats & Attacks", phishing: "Threats & Attacks", malware: "Threats & Attacks", owasp: "Threats & Attacks", "social-engineering": "Threats & Attacks",
  defense: "Defense & Hardening", firewall: "Defense & Hardening", ids: "Defense & Hardening", ips: "Defense & Hardening", edr: "Defense & Hardening",
  ir: "Incident Response & Forensics", "incident-response": "Incident Response & Forensics", forensics: "Incident Response & Forensics", siem: "Incident Response & Forensics", logs: "Incident Response & Forensics",
  frameworks: "Frameworks & Standards", "attack": "Frameworks & Standards", mitre: "Frameworks & Standards", nist: "Frameworks & Standards", iso: "Frameworks & Standards", "kill-chain": "Frameworks & Standards",
  cloud: "Cloud Security", iam: "Cloud Security",
  programming: "Programming for Security", scripting: "Programming for Security", python: "Programming for Security",
  ethics: "Ethics & Rules of Engagement", roe: "Ethics & Rules of Engagement", legal: "Ethics & Rules of Engagement",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "cybersecurity.md"), "utf8"); } catch { return ""; } }
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
  name: "cybersecurity_guide",
  description:
    "Basis pengetahuan Cyber Security (defensif/edukatif): fundamentals, OS & networking, konsep keamanan (CIA/zero-trust/AAA), kriptografi, threats & attacks (awareness untuk bertahan), defense & hardening, incident response & forensics, frameworks (MITRE ATT&CK/NIST/ISO), cloud security, programming for security, etika/RoE. Panggil untuk best-practice keamanan defensif. topic: fundamentals|os|network|concepts|crypto|threats|defense|ir|frameworks|cloud|programming|ethics|all; query opsional.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "fundamentals, os, network, concepts, crypto, threats, defense, ir, frameworks, cloud, programming, ethics, atau all" },
      query: { type: "string", description: "Kata kunci opsional." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base cyber security belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: fundamentals, os, network, concepts, crypto, threats, defense, ir, frameworks, cloud, programming, ethics, atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
