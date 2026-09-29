// Eval harness (roadmap: Evaluation & Testing). Jalankan kumpulan kasus lewat agent,
// nilai dari substring jawaban & tool yang dipakai. Jalankan: `npm run eval [file.json]`.
import fs from "node:fs";
import path from "node:path";
import { loadSkills } from "./skills.js";
import { Agent } from "./agent.js";
import { Memory } from "./memory.js";
import { config, PACKAGE_ROOT } from "./config.js";
import { getProvider } from "./providers/index.js";

// Model-based eval (roadmap: Evaluation Types > Model-Based Evals): nilai jawaban pakai LLM.
async function judgeReply(rubric, input, reply) {
  try {
    const provider = getProvider();
    const { text } = await provider.run({
      system: "Kamu penilai kualitas. Nilai apakah JAWABAN memenuhi KRITERIA. Balas HANYA 'YA' atau 'TIDAK' di awal, lalu alasan singkat.",
      turns: [{ role: "user", text: `KRITERIA: ${rubric}\n\nPERTANYAAN: ${input}\n\nJAWABAN: ${reply}` }],
      tools: [], runSkill: async () => "", onDelta: null,
    });
    return { ok: /^\s*ya\b/i.test(text || ""), detail: (text || "").replace(/\s+/g, " ").slice(0, 100) };
  } catch (e) { return { ok: false, detail: "judge error: " + e.message }; }
}

export async function runCases(cases) {
  const { tools, dispatch, skills } = await loadSkills();
  const results = [];
  for (const c of cases) {
    const agent = new Agent({ memory: new Memory(), tools, dispatch, skills });
    const toolsCalled = [];
    let reply = "", err = null;
    try { reply = await agent.chat(c.input, { onTool: (n) => toolsCalled.push(n), onDelta: () => {} }); }
    catch (e) { err = e.message; }
    const checks = [];
    if (!err) {
      for (const sub of c.expect || []) checks.push({ ok: reply.toLowerCase().includes(String(sub).toLowerCase()), label: `berisi "${sub}"` });
      if (c.expect_tool) checks.push({ ok: toolsCalled.includes(c.expect_tool), label: `pakai tool ${c.expect_tool}` });
      if (c.judge) { const j = await judgeReply(c.judge, c.input, reply); checks.push({ ok: j.ok, label: `judge(${c.judge.slice(0, 30)}) → ${j.detail}` }); }
    }
    results.push({ name: c.name, pass: !err && checks.every((x) => x.ok), err, checks, tools: toolsCalled, reply: (reply || "").slice(0, 100) });
  }
  return results;
}

async function main() {
  const file = process.argv[2] || path.join(PACKAGE_ROOT, "evals", "basic.json");
  let cases;
  try { cases = JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (e) { console.error(`Tidak bisa baca eval file: ${file} (${e.message})`); process.exit(2); }
  console.log(`\nEval: ${file}  ·  ${cases.length} kasus  ·  provider ${config.provider}/${config.providers[config.provider].model}\n`);
  const results = await runCases(cases);
  let pass = 0;
  for (const r of results) {
    const mark = r.pass ? "✅" : "❌";
    console.log(`${mark} ${r.name}`);
    if (r.err) console.log(`     error: ${r.err}`);
    else {
      for (const c of r.checks) console.log(`     ${c.ok ? "·" : "✗"} ${c.label}`);
      console.log(`     tools: [${r.tools.join(", ")}]  reply: ${JSON.stringify(r.reply)}`);
    }
    if (r.pass) pass++;
  }
  console.log(`\nHasil: ${pass}/${results.length} lulus\n`);
  process.exit(pass === results.length ? 0 : 1);
}
if (process.argv[1] && process.argv[1].endsWith("eval.js")) main();
