// Skill: basis pengetahuan AI & Data Science (disuling dari roadmap.sh/ai-data-scientist).
// Agent memanggilnya untuk best-practice sebelum tugas data/ML/statistik.
import fs from "node:fs";
import path from "node:path";
import { config } from "../src/config.js";

const SECTIONS = ["Mathematics", "Statistics", "A/B Testing", "Econometrics & Time Series", "Python", "SQL",
  "Exploratory Data Analysis", "Machine Learning", "Deep Learning", "MLOps", "AI Engineering", "Tools & Libraries"];
const ALIASES = {
  math: "Mathematics", mathematics: "Mathematics", "linear-algebra": "Mathematics", calculus: "Mathematics",
  stat: "Statistics", stats: "Statistics", statistics: "Statistics", "hypothesis": "Statistics", probability: "Statistics",
  ab: "A/B Testing", "a/b": "A/B Testing", abtest: "A/B Testing", experiment: "A/B Testing",
  econometrics: "Econometrics & Time Series", timeseries: "Econometrics & Time Series", "time-series": "Econometrics & Time Series", regression: "Econometrics & Time Series", arima: "Econometrics & Time Series",
  python: "Python", pandas: "Python", numpy: "Python",
  sql: "SQL",
  eda: "Exploratory Data Analysis", "exploratory": "Exploratory Data Analysis", cleaning: "Exploratory Data Analysis",
  ml: "Machine Learning", "machine-learning": "Machine Learning", sklearn: "Machine Learning", xgboost: "Machine Learning",
  dl: "Deep Learning", "deep-learning": "Deep Learning", neural: "Deep Learning", cnn: "Deep Learning", rnn: "Deep Learning", transformer: "Deep Learning", pytorch: "Deep Learning",
  mlops: "MLOps", deployment: "MLOps", monitoring: "MLOps",
  "ai-engineering": "AI Engineering", llm: "AI Engineering", rag: "AI Engineering",
  tools: "Tools & Libraries", libraries: "Tools & Libraries", library: "Tools & Libraries",
};

function loadDoc() { try { return fs.readFileSync(path.join(config.knowledgeDir, "data-science.md"), "utf8"); } catch { return ""; } }
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
  name: "datascience_guide",
  description:
    "Basis pengetahuan AI & Data Science: matematika, statistik, A/B testing, ekonometrika/time-series, Python, SQL, EDA, machine learning, deep learning, MLOps, AI engineering, tools. Panggil untuk best-practice sebelum tugas data/analisis/ML/statistik. topic: math|stats|ab|timeseries|python|sql|eda|ml|dl|mlops|ai-engineering|tools|all; query opsional.",
  input_schema: {
    type: "object",
    properties: {
      topic: { type: "string", description: "math, stats, ab, timeseries, python, sql, eda, ml, dl, mlops, ai-engineering, tools, atau all" },
      query: { type: "string", description: "Kata kunci opsional untuk mencari baris relevan." },
    },
  },
  async run(input) {
    const doc = loadDoc();
    if (!doc) return "Knowledge base data science belum tersedia.";
    const topic = (input.topic || "all").toLowerCase();
    let out;
    if (topic === "all") out = doc;
    else {
      const title = ALIASES[topic] || SECTIONS.find((s) => s.toLowerCase() === topic);
      out = title ? extractSection(doc, title) : "";
      if (!out) return `Topik "${input.topic}" tak dikenal. Pilih: ${Object.keys(ALIASES).slice(0, 12).join(", ")}, ... atau all.`;
    }
    if (input.query) {
      const hits = out.split("\n").filter((l) => l.toLowerCase().includes(input.query.toLowerCase()));
      if (hits.length) return `Pedoman terkait "${input.query}":\n` + hits.join("\n");
    }
    return out.length > 6000 ? out.slice(0, 6000) + "\n… [dipotong]" : out;
  },
};
