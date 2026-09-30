// Skill: basis pengetahuan AI Red Teaming (disuling dari roadmap.sh/ai-red-teaming).
// Defensif/edukatif: menguji & memperkuat sistem AI milik/otorisasi sendiri.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Introduction & Ethics", "AI/ML Foundations", "AI Security Concepts", "Prompt Hacking",
  "Model Vulnerabilities & Defenses", "Infrastructure Security", "Testing Methodology", "Defense Strategies",
  "Agentic AI Security", "Practice, Community & Growth"];
const ALIASES = {
  intro: "Introduction & Ethics", ethics: "Introduction & Ethics", disclosure: "Introduction & Ethics",
  foundations: "AI/ML Foundations", ml: "AI/ML Foundations", llm: "AI/ML Foundations",
  concepts: "AI Security Concepts", "threat-model": "AI Security Concepts", risk: "AI Security Concepts",
  prompt: "Prompt Hacking", "prompt-injection": "Prompt Hacking", injection: "Prompt Hacking", jailbreak: "Prompt Hacking",
  model: "Model Vulnerabilities & Defenses", poisoning: "Model Vulnerabilities & Defenses", adversarial: "Model Vulnerabilities & Defenses", extraction: "Model Vulnerabilities & Defenses",
  infra: "Infrastructure Security", infrastructure: "Infrastructure Security", api: "Infrastructure Security",
  testing: "Testing Methodology", test: "Testing Methodology", "black-box": "Testing Methodology",
  defense: "Defense Strategies", guardrail: "Defense Strategies", mitigation: "Defense Strategies",
  agent: "Agentic AI Security", agentic: "Agentic AI Security", tools: "Agentic AI Security",
  practice: "Practice, Community & Growth", ctf: "Practice, Community & Growth", cert: "Practice, Community & Growth",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "ai-red-teaming.md"), "utf8"); } catch { return ""; } }
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
  name: "airedteam_guide",
  description:
    "Basis pengetahuan AI Red Teaming (defensif): menguji & memperkuat keamanan sistem AI/LLM/agent milik/otorisasi sendiri. Konsep + deteksi + MITIGASI: etika/RoE, fondasi ML, konsep keamanan AI, prompt hacking & countermeasure, kerentanan model & pertahanan, infrastruktur, metodologi pengujian, defense strategies, keamanan agentic AI. Panggil untuk menilai/mengeraskan keamanan aplikasi AI. topic: intro|foundations|concepts|prompt|model|infra|testing|defense|agent|practice|all; query opsional.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "intro, foundations, concepts, prompt, model, infra, testing, defense, agent, practice, atau all" },
      query: { type: "string", description: "Kata kunci opsional." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base AI red teaming belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: intro, foundations, concepts, prompt, model, infra, testing, defense, agent, practice, atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
