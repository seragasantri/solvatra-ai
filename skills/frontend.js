// Skill: bantu bangun frontend menarik & profesional yang menyesuaikan STACK program user.
// action 'detect_stack' membaca manifest project (package.json/composer.json) -> deteksi
// framework + rekomendasi library UI. action 'write_files' menuliskan file frontend yang
// sudah disusun agent ke folder tujuan (dikurung agar aman).
import fs from "node:fs";
import path from "node:path";

// Rekomendasi library UI berdasarkan framework terdeteksi.
const LIB_ADVICE = {
  next: "Tailwind CSS + shadcn/ui, lucide-react (ikon), framer-motion (animasi). Layout via app/layout.tsx.",
  react: "Tailwind CSS + shadcn/ui atau Radix UI, lucide-react, framer-motion. State theme/sidebar via zustand/useState+localStorage.",
  vue: "Tailwind CSS + PrimeVue/Naive UI atau headlessui-vue, lucide-vue-next, VueUse (useStorage/useDark).",
  nuxt: "Tailwind + @nuxt/ui atau shadcn-vue, lucide, VueUse.",
  angular: "Tailwind + Angular Material atau PrimeNG, angular-animations.",
  svelte: "Tailwind + skeleton/bits-ui, lucide-svelte.",
  laravel: "Blade + Tailwind CSS + Alpine.js (+@alpinejs/persist,@alpinejs/collapse) + SweetAlert2. Cocok banget dengan template simobe-lpm (pakai langsung).",
  django: "Tailwind (django-tailwind) atau Bootstrap 5 + HTMX + Alpine.js untuk interaktivitas ringan.",
  express: "EJS/Handlebars + Tailwind, atau pisahkan SPA (React/Vue). Alpine.js untuk halaman server-rendered.",
  static: "HTML + Tailwind (CDN atau build) + Alpine.js. Ringan, tanpa build tool berat.",
};

// Konvensi library per keluarga stack (tabel, dropdown, ikon).
const BLADE_CONV = {
  table: "DataTables (jQuery) — https://datatables.net",
  select: "select2 — https://select2.org",
  icons: "Font Awesome — https://fontawesome.com/icons (<i class=\"fa-solid fa-...\">)",
};
const JS_CONV = {
  table: "@tanstack/react-table — https://tanstack.com/table (headless)",
  select: "react-select — https://react-select.com (di shadcn: boleh Combobox)",
  icons: "react-icons — https://react-icons.github.io/react-icons/ (lucide-react tetap boleh utk ikon shadcn)",
};
// Framework server-rendered berbasis Blade/jQuery vs framework komponen JS.
const BLADE_FAMILY = new Set(["laravel"]);
function conventionsFor(framework) {
  return BLADE_FAMILY.has(framework) ? BLADE_CONV : JS_CONV;
}

function detectStack(projectPath) {
  const p = projectPath || ".";
  const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(p, f), "utf8")); } catch { return null; } };
  const exists = (f) => fs.existsSync(path.join(p, f));

  const pkg = read("package.json");
  const composer = read("composer.json");
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) };
  const cdeps = { ...(composer?.require || {}), ...(composer?.["require-dev"] || {}) };
  const has = (k) => k in deps;
  const chas = (k) => Object.keys(cdeps).some((x) => x.includes(k));

  let framework = "static";
  if (chas("laravel/framework") || exists("artisan")) framework = "laravel";
  else if (chas("symfony")) framework = "symfony";
  else if (exists("manage.py")) framework = "django";
  else if (has("next")) framework = "next";
  else if (has("nuxt")) framework = "nuxt";
  else if (has("@angular/core")) framework = "angular";
  else if (has("svelte") || has("@sveltejs/kit")) framework = "svelte";
  else if (has("vue")) framework = "vue";
  else if (has("react")) framework = "react";
  else if (has("express") || has("fastify")) framework = "express";

  const styling = [];
  if (has("tailwindcss")) styling.push("tailwindcss");
  if (has("bootstrap")) styling.push("bootstrap");
  if (has("alpinejs")) styling.push("alpinejs");
  if (has("sass")) styling.push("sass");

  return {
    project_path: path.resolve(p),
    framework,
    language: pkg?.type === "module" || has("typescript") ? (has("typescript") ? "typescript" : "javascript(esm)") : (pkg ? "javascript" : (composer ? "php" : "unknown")),
    existing_styling: styling,
    key_dependencies: Object.keys(deps).slice(0, 20),
    recommended_ui: LIB_ADVICE[framework] || LIB_ADVICE.static,
    conventions: conventionsFor(framework),
    note: "Gunakan library UI yang cocok dengan framework ini. Kalau sudah ada Tailwind/Alpine, ikuti yang ada — jangan tambah stack yang bentrok.",
  };
}

export default {
  name: "frontend",
  description:
    "Bantu bangun frontend profesional yang menyesuaikan stack program. action 'detect_stack' membaca package.json/composer.json di project_path lalu mendeteksi framework + merekomendasikan library UI. action 'write_files' menuliskan file-file frontend (yang sudah kamu susun) ke out_dir. Alur umum: detect_stack -> (opsional load template via frontend_template) -> susun kode adaptif -> write_files.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["detect_stack", "write_files"] },
      project_path: { type: "string", description: "Path project yang sedang dikembangkan (untuk detect_stack)." },
      out_dir: { type: "string", description: "Folder tujuan penulisan file (untuk write_files)." },
      files: {
        type: "array",
        description: "Daftar file yang akan ditulis (untuk write_files).",
        items: {
          type: "object",
          properties: { path: { type: "string" }, content: { type: "string" } },
          required: ["path", "content"],
        },
      },
    },
    required: ["action"],
  },
  async run(input, ctx) {
    if (input.action === "detect_stack") {
      return JSON.stringify(detectStack(input.project_path), null, 2);
    }
    if (input.action === "write_files") {
      const outDir = input.out_dir;
      if (!outDir) return "write_files butuh out_dir.";
      if (!Array.isArray(input.files) || !input.files.length) return "write_files butuh files[].";
      const root = path.resolve(outDir);
      const written = [];
      for (const f of input.files) {
        const target = path.resolve(root, f.path);
        // Kurung: file harus berada di dalam out_dir (cegah path traversal).
        if (target !== root && !target.startsWith(root + path.sep)) {
          return `Ditolak: "${f.path}" keluar dari out_dir.`;
        }
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, f.content);
        written.push(path.relative(root, target));
      }
      return `Ditulis ${written.length} file ke ${root}:\n` + written.map((w) => `- ${w}`).join("\n");
    }
    return "action tidak dikenal (pakai 'detect_stack' atau 'write_files').";
  },
};
