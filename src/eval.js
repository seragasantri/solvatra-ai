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
  // Model penilai sering tidak patuh format "mulai dengan YA/TIDAK" (membuka dengan
  // "Saya akan menilai…"), jadi vonis diminta di baris terakhir yang eksplisit dan dicari di mana pun.
  // Instruksi penilaian ditaruh juga di pesan user: sebagian model mengabaikan system prompt
  // dan malah "menjawab" isi JAWABAN alih-alih menilainya.
  const ask = async (extra = "") => {
    const provider = getProvider();
    const rules = "Tugasmu HANYA menilai, bukan menjawab pertanyaannya. Tulis alasan singkat (maks 2 kalimat), " +
      "lalu AKHIRI dengan satu baris persis: VONIS: YA  atau  VONIS: TIDAK" + extra;
    const { text } = await provider.run({
      system: "Kamu penilai kualitas yang ketat. " + rules,
      turns: [{ role: "user", text:
        `Nilai apakah JAWABAN di bawah memenuhi KRITERIA.\n${rules}\n\nKRITERIA: ${rubric}\n\nPERTANYAAN ASLI: ${input}\n\n` +
        `<<<JAWABAN\n${reply}\nJAWABAN>>>\n\nSekarang beri alasan singkat lalu baris VONIS.` }],
      tools: [], runSkill: async () => "", onDelta: null,
    });
    const all = [...String(text || "").matchAll(/VONIS\s*:\s*\**\s*(YA|TIDAK)/gi)];
    const verdict = all.length ? all[all.length - 1][1].toUpperCase() : (/^\s*(ya|tidak)\b/i.exec(text || "")?.[1] || "").toUpperCase();
    return { verdict, text: String(text || "") };
  };
  try {
    let r = await ask();
    if (!r.verdict) r = await ask(" — WAJIB ada baris VONIS di akhir.");
    return { ok: r.verdict === "YA", detail: (r.verdict ? `VONIS ${r.verdict}: ` : "tanpa vonis: ") + r.text.replace(/\s+/g, " ").slice(0, 90) };
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
