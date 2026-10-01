// Skill loader. Memuat skill dari BEBERAPA folder: bawaan (package) + buatan user (~/.traga/skills).
// Setiap file .js yang mengekspor default { name, description, input_schema, run } jadi "tool".
// Skill user dengan nama sama akan menimpa bawaan (override) — KECUALI tool inti di bawah:
// versi bawaan selalu menang, supaya versi rusak buatan model (create_skill) tidak menggantikannya.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config } from "./config.js";

export const CORE_TOOLS = new Set(["run_command", "write_file", "edit_file", "read_file", "list_dir", "search_code"]);

export async function loadSkills() {
  const byName = new Map(); // nama -> skill (urutan: bawaan dulu, lalu user menimpa)
  for (const dir of config.skillsDirs) {
    const bundled = dir === config.bundledSkillsDir;
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".js")); } catch { continue; }
    for (const file of files) {
      const url = pathToFileURL(path.join(dir, file)).href + `?t=${Date.now()}`;
      let mod;
      try { mod = await import(url); } catch (e) { console.warn(`[skills] gagal impor ${file}: ${e.message}`); continue; }
      const skill = mod.default;
      if (!skill || !skill.name || typeof skill.run !== "function") {
        console.warn(`[skills] lewati ${file}: tidak mengekspor { name, run }`);
        continue;
      }
      if (!bundled && CORE_TOOLS.has(skill.name) && byName.has(skill.name)) continue; // tool inti: bawaan menang
      byName.set(skill.name, skill);
    }
  }

  const skills = [...byName.values()];
  const tools = skills.map((s) => ({
    name: s.name,
    description: s.description || "",
    input_schema: s.input_schema || { type: "object", properties: {} },
  }));
  const dispatch = new Map(skills.map((s) => [s.name, s.run]));
  return { tools, dispatch, skills };
}
