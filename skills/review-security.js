// Skill: review keamanan defensif untuk proyek MILIK user — secret bocor, pola kode berbahaya
// (JS/TS, PHP/Laravel, Python, konfigurasi), .env yang ter-commit, dan audit dependency.
// Temuan berbasis pola: model WAJIB memverifikasi tiap temuan dengan membaca kodenya.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const SKIP_DIRS = new Set(["node_modules", "vendor", ".git", "dist", "build", ".next", ".nuxt", "coverage", "out",
  ".venv", "venv", "__pycache__", ".cache", "public/build", "storage/framework", ".idea", ".vscode"]);
const TEXT_EXT = /\.(js|mjs|cjs|jsx|ts|tsx|vue|svelte|php|py|rb|go|java|cs|env|ya?ml|json|toml|ini|conf|sh|sql|html?|twig)$|(^|\/)(\.env[^/]*|Dockerfile|docker-compose\.ya?ml|nginx\.conf)$/i;
const MAX_FILES = 4000, MAX_SIZE = 600_000, MAX_PER_RULE = 15, MAX_TOTAL = 150;
const SEV = ["Kritis", "Tinggi", "Sedang", "Rendah"];

const PLACEHOLDER = /x{4,}|your[_-]|changeme|example|dummy|placeholder|<[^>]+>|\$\{|process\.env|env\(|getenv|os\.environ|\*{3,}|•/i;
const mask = (s) => (s.length <= 10 ? "••••" : `${s.slice(0, 6)}••••${s.slice(-4)}`);

// [id, severity, berlaku untuk (regex path), pola, judul, perbaikan, (opsional) ambil secret]
const RULES = [
  ["private-key", 0, /./, /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP |ENCRYPTED )?PRIVATE KEY-----/, "Secret: private key di file", "Keluarkan dari repo, rotasi kunci, simpan di secret manager/env.", true],
  ["aws-key", 0, /./, /AKIA[0-9A-Z]{16}/, "Secret: AWS access key", "Nonaktifkan & rotasi key di IAM, pindah ke env/secret manager.", true],
  ["github-token", 0, /./, /gh[pousr]_[A-Za-z0-9]{36,}/, "Secret: token GitHub", "Cabut token di GitHub Settings → Developer settings, ganti lewat env.", true],
  ["npm-token", 0, /./, /npm_[A-Za-z0-9]{36}/, "Secret: token npm", "Cabut di npmjs.com → Access Tokens.", true],
  ["stripe-live", 0, /./, /sk_live_[0-9a-zA-Z]{24,}/, "Secret: Stripe live key", "Rotasi di dashboard Stripe.", true],
  ["solvatra-key", 0, /./, /tg_live_[A-Za-z0-9_-]{20,}/, "Secret: API key Solvatra", "Cabut di solvatra.web.id → API Keys.", true],
  ["slack-token", 1, /./, /xox[baprs]-[A-Za-z0-9-]{10,}/, "Secret: token Slack", "Cabut & rotasi token.", true],
  ["google-key", 1, /./, /AIza[0-9A-Za-z_-]{35}/, "Secret: Google API key", "Batasi/rotasi key di Google Cloud Console.", true],
  ["generic-secret", 1, /\.(js|mjs|cjs|jsx|ts|tsx|php|py|rb|go|java|cs|ya?ml|json|toml|ini|conf)$/i,
    /(api[_-]?key|secret|passw(or)?d|token|private[_-]?key)["']?\s*[:=]\s*["']([^"'\s]{8,})["']/i, "Secret ditulis langsung di kode", "Pindahkan ke variabel lingkungan / secret manager; rotasi bila sudah ter-commit.", true],
  // JS / TS
  ["js-eval", 1, /\.(m?js|cjs|jsx?|tsx?|vue|svelte)$/i, /\beval\s*\(|new\s+Function\s*\(/, "Eksekusi kode dinamis (eval/new Function)", "Hindari eval; parse data dengan JSON.parse / logika eksplisit."],
  ["js-cmd-injection", 1, /\.(m?js|cjs|jsx?|tsx?)$/i, /\b(exec|execSync)\s*\(\s*(`[^`]*\$\{|[^)\n]*\+\s*[\w.[\]]+)/, "Kemungkinan command injection (exec dengan string dinamis)", "Pakai execFile/spawn dengan array argumen; validasi/whitelist input."],
  ["js-sql-concat", 1, /\.(m?js|cjs|jsx?|tsx?)$/i, /\b(query|execute|raw|\$queryRawUnsafe|\$executeRawUnsafe)\s*\(\s*(`[^`]*\$\{|["'][^"']*\b(SELECT|INSERT|UPDATE|DELETE)\b[^"']*["']\s*\+)/i, "Kemungkinan SQL injection (query dirangkai string)", "Pakai parameter binding / query builder ($queryRaw tagged template, ?)."],
  ["js-innerhtml", 2, /\.(m?js|cjs|jsx?|tsx?|vue|html?)$/i, /\.(innerHTML|outerHTML)\s*=(?!\s*["'`]\s*["'`]\s*;?)|insertAdjacentHTML\s*\(|document\.write\s*\(/, "Potensi XSS (HTML dari data dinamis)", "Pakai textContent, atau sanitasi (DOMPurify) bila memang harus HTML."],
  ["js-dangerous-html", 2, /\.(jsx|tsx)$/i, /dangerouslySetInnerHTML/, "Potensi XSS (dangerouslySetInnerHTML)", "Pastikan isi disanitasi (DOMPurify) atau render sebagai teks."],
  ["js-vue-vhtml", 2, /\.vue$/i, /\sv-html\s*=/, "Potensi XSS (v-html)", "Sanitasi isi atau render sebagai teks."],
  ["tls-off", 1, /\.(m?js|cjs|jsx?|tsx?|py|php|env|ya?ml)$/i, /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|verify\s*=\s*False|CURLOPT_SSL_VERIFYPEER\s*,\s*(false|0)/, "Verifikasi TLS dimatikan", "Aktifkan verifikasi sertifikat; perbaiki CA bila bermasalah."],
  ["cors-wildcard", 2, /\.(m?js|cjs|tsx?|php|py|conf|ya?ml)$/i, /origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[,:]?\s*["']?\*|allowed_origins["']?\s*=>\s*\[\s*["']\*["']/i, "CORS mengizinkan semua origin (*)", "Batasi ke origin resmi, terutama untuk endpoint dengan kredensial."],
  ["jwt-none", 1, /\.(m?js|cjs|tsx?|py|php)$/i, /algorithms?\s*[:=]\s*\[?\s*["']none["']/i, "JWT menerima algoritma 'none'", "Tetapkan algoritma eksplisit (HS256/RS256) saat verifikasi."],
  ["weak-random", 2, /\.(m?js|cjs|tsx?|php)$/i, /(token|secret|otp|password|reset)\w*\s*[:=][^;\n]*(Math\.random\(|\brand\(|\bmt_rand\()/i, "Nilai rahasia dari generator acak lemah", "Pakai crypto.randomBytes / random_bytes / secrets."],
  // PHP / Laravel
  ["php-raw-sql", 1, /\.php$/i, /(DB::raw|whereRaw|selectRaw|orderByRaw|havingRaw|groupByRaw|DB::(select|statement|insert|update|delete|unprepared))\s*\(\s*("[^"]*\$|'[^']*'\s*\.\s*\$)|->(query|exec)\s*\(\s*("[^"]*\$|'[^']*'\s*\.\s*\$)|mysqli_query\s*\([^)]*\$/, "Kemungkinan SQL injection (SQL mentah berisi variabel)", "Pakai binding: whereRaw('col = ?', [$val]) / Eloquent / prepared statement."],
  ["php-eval", 1, /\.php$/i, /\beval\s*\(|\bassert\s*\(\s*\$|create_function\s*\(/, "Eksekusi kode dinamis (eval/assert)", "Hapus eval; ganti dengan logika eksplisit."],
  ["php-cmd", 1, /\.php$/i, /\b(shell_exec|exec|system|passthru|popen|proc_open)\s*\([^)]*\$/, "Kemungkinan command injection (perintah shell berisi variabel)", "Hindari shell; bila perlu, escapeshellarg() + whitelist, atau Symfony Process dengan array argumen."],
  ["php-unserialize", 0, /\.php$/i, /unserialize\s*\(\s*\$(_(GET|POST|REQUEST|COOKIE)|request)/, "Deserialisasi data dari user (object injection)", "Pakai json_decode untuk data dari user."],
  ["php-lfi", 0, /\.php$/i, /(include|require)(_once)?\s*\(?\s*\$_(GET|POST|REQUEST)/, "File inclusion dari input user (LFI/RFI)", "Jangan include path dari user; pakai whitelist."],
  ["php-echo-input", 1, /\.php$/i, /echo\s+\$_(GET|POST|REQUEST|COOKIE)/, "XSS: input user dicetak langsung", "Escape dengan htmlspecialchars() / e()."],
  ["blade-unescaped", 2, /\.blade\.php$/i, /\{!!\s*(?!\s*(csrf_field|method_field|config|route|asset|__|trans|json_encode|Vite|@))[^}]*\$/, "XSS: output Blade tidak di-escape ({!! !!})", "Pakai {{ }} kecuali isinya HTML tepercaya yang sudah disanitasi."],
  ["php-weak-hash", 1, /\.php$/i, /(md5|sha1)\s*\(\s*\$[^)]*pass/i, "Password di-hash dengan md5/sha1", "Pakai Hash::make / password_hash()."],
  ["laravel-mass-assign", 3, /Models?\/.*\.php$/i, /protected\s+\$guarded\s*=\s*\[\s*\]/, "Model tanpa proteksi mass assignment ($guarded = [])", "Gunakan $fillable eksplisit."],
  // Python
  ["py-eval", 1, /\.py$/i, /\b(eval|exec)\s*\(/, "Eksekusi kode dinamis (eval/exec)", "Hindari; pakai ast.literal_eval untuk literal."],
  ["py-cmd", 1, /\.py$/i, /os\.system\s*\(|os\.popen\s*\(|subprocess\.\w+\([^)]*shell\s*=\s*True/, "Kemungkinan command injection (shell=True/os.system)", "Pakai subprocess.run([...]) tanpa shell; validasi input."],
  ["py-deserialize", 1, /\.py$/i, /pickle\.loads?\s*\(|yaml\.load\s*\((?![^)]*Loader\s*=\s*yaml\.SafeLoader)/, "Deserialisasi tidak aman (pickle / yaml.load)", "Pakai json atau yaml.safe_load."],
  ["py-sql", 1, /\.py$/i, /execute\s*\(\s*f["']|execute\s*\(\s*["'][^"']*["']\s*%\s*|execute\s*\(\s*["'][^"']*["']\s*\.format\(/, "Kemungkinan SQL injection (query dirangkai)", "Pakai parameter: cursor.execute(sql, (val,))."],
  ["py-debug", 2, /settings\.py$/i, /^\s*DEBUG\s*=\s*True/m, "DEBUG=True di settings", "Matikan di produksi (ambil dari env)."],
  // Konfigurasi
  ["env-debug", 1, /(^|\/)\.env(\.production|\.prod)?$/i, /^\s*APP_DEBUG\s*=\s*true/im, "APP_DEBUG=true (bocor stack trace & env di produksi)", "Set APP_DEBUG=false di produksi."],
  ["nginx-autoindex", 3, /\.conf$|nginx/i, /^\s*autoindex\s+on/m, "Listing direktori aktif (autoindex on)", "Matikan autoindex kecuali memang perlu."],
  ["docker-secret", 1, /Dockerfile$/i, /^\s*(ENV|ARG)\s+\w*(SECRET|PASSWORD|TOKEN|API_KEY)\w*\s*[= ]\s*\S+/im, "Secret ditanam di image Docker", "Berikan saat runtime (env/secret), bukan di Dockerfile."],
];

function walk(root) {
  const files = [];
  const stack = [root];
  while (stack.length && files.length < MAX_FILES) {
    const dir = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      const rel = path.relative(root, full);
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name) || SKIP_DIRS.has(rel)) continue;
        stack.push(full);
      } else if (e.isFile() && TEXT_EXT.test(rel) && !/\.min\.(js|css)$|\.lock$|package-lock\.json$/i.test(rel)) {
        files.push(rel);
      }
    }
  }
  return files;
}

/** Baris yang DITAMBAHKAN di diff kerja (vs HEAD) + file untracked utuh: { rel: [[lineNo, text], …] } */
function diffLines(root) {
  const r = spawnSync("git", ["diff", "-U0", "HEAD", "--no-color"], { cwd: root, encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  if (r.status !== 0) return null;
  const out = {};
  let file = null, line = 0;
  for (const l of r.stdout.split("\n")) {
    if (l.startsWith("+++ ")) { file = l.slice(4).replace(/^b\//, ""); if (file === "/dev/null") file = null; continue; }
    const h = l.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
    if (h) { line = Number(h[1]); continue; }
    if (file && l.startsWith("+") && !l.startsWith("+++")) { (out[file] ??= []).push([line, l.slice(1)]); line++; }
  }
  const u = spawnSync("git", ["ls-files", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" });
  for (const f of (u.stdout || "").split("\n").filter(Boolean)) {
    if (!TEXT_EXT.test(f)) continue;
    try { out[f] = fs.readFileSync(path.join(root, f), "utf8").split("\n").map((t, i) => [i + 1, t]); } catch {}
  }
  return out;
}

function audit(root) {
  const lines = [];
  const has = (f) => fs.existsSync(path.join(root, f));
  const runJson = (cmd, args) => {
    const r = spawnSync(cmd, args, { cwd: root, encoding: "utf8", timeout: 90_000, maxBuffer: 50 * 1024 * 1024 });
    if (r.error) return null;
    try { return JSON.parse(r.stdout); } catch { return null; }
  };
  if (has("package-lock.json")) {
    const j = runJson("npm", ["audit", "--json", "--omit=dev"]);
    const v = j?.metadata?.vulnerabilities;
    if (v) {
      const names = Object.entries(j.vulnerabilities || {}).filter(([, x]) => ["critical", "high"].includes(x.severity)).slice(0, 8)
        .map(([n, x]) => `${n} (${x.severity}${x.fixAvailable ? ", ada perbaikan" : ""})`);
      lines.push(`npm audit (produksi): kritis ${v.critical || 0} · tinggi ${v.high || 0} · sedang ${v.moderate || 0} · rendah ${v.low || 0}` + (names.length ? `\n    ${names.join("; ")}\n    Perbaikan: npm audit fix (cek breaking change), atau naikkan versi paketnya.` : ""));
    } else lines.push("npm audit: tidak bisa dijalankan (npm tidak ada / offline).");
  }
  if (has("composer.lock")) {
    const j = runJson("composer", ["audit", "--format=json", "--no-dev"]);
    if (j && j.advisories) {
      const adv = Object.entries(j.advisories).flatMap(([p, list]) => (list || []).map((a) => `${p}: ${a.title}`));
      lines.push(`composer audit: ${adv.length} advisory` + (adv.length ? `\n    ${adv.slice(0, 8).join("\n    ")}\n    Perbaikan: composer update <paket> ke versi aman.` : ""));
    } else lines.push("composer audit: tidak bisa dijalankan (composer tidak ada / offline).");
  }
  if (has("requirements.txt")) {
    const j = runJson("pip-audit", ["-r", "requirements.txt", "-f", "json"]);
    if (j) {
      const deps = (j.dependencies || j).filter?.((d) => d.vulns?.length) || [];
      lines.push(`pip-audit: ${deps.length} paket rentan` + (deps.length ? `\n    ${deps.slice(0, 8).map((d) => `${d.name} ${d.version}`).join(", ")}` : ""));
    } else lines.push("pip-audit: tidak terpasang (pip install pip-audit) — dependency Python tidak diaudit.");
  }
  return lines;
}

export default {
  name: "review_security",
  description:
    "Review keamanan DEFENSIF untuk proyek milik user: secret yang bocor, pola kode berbahaya (SQL/command injection, XSS, eval, deserialisasi, TLS mati, CORS *, " +
    "APP_DEBUG, dll. untuk JS/TS, PHP/Laravel, Python, konfigurasi), .env yang ter-commit, dan audit dependency (npm/composer/pip-audit). " +
    "mode 'project' (seluruh folder) atau 'diff' (hanya perubahan belum di-commit). Hasilnya temuan BERBASIS POLA — verifikasi tiap temuan dengan read_file sebelum menyimpulkan.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Folder proyek (default folder kerja)." },
      mode: { type: "string", enum: ["project", "diff"], description: "project (default) atau diff." },
      audit_deps: { type: "boolean", description: "Jalankan audit dependency (default true untuk mode project)." },
    },
  },
  async run(input) {
    const root = path.resolve(input.path || process.cwd());
    if (!fs.existsSync(root)) return `Folder tidak ada: ${root}`;
    const mode = input.mode === "diff" ? "diff" : "project";
    const findings = [];
    const perRule = {};
    let scanned = 0;

    const check = (rel, pairs) => {
      for (const [id, sev, applies, re, title, fix, isSecret] of RULES) {
        if (!applies.test(rel)) continue;
        if (/\.example$|\.sample$|\.dist$/i.test(rel) && sev > 0) continue;
        for (const [ln, text] of pairs) {
          if (findings.length >= MAX_TOTAL || (perRule[id] || 0) >= MAX_PER_RULE) break;
          const m = text.match(re);
          if (!m) continue;
          let snippet = text.trim().slice(0, 160);
          if (isSecret) {
            const secret = m[3] || m[0];
            if (id === "generic-secret" && PLACEHOLDER.test(secret)) continue;
            snippet = snippet.split(secret).join(mask(secret));
          }
          perRule[id] = (perRule[id] || 0) + 1;
          findings.push({ sev, title, fix, at: `${rel}:${ln}`, snippet });
        }
      }
    };

    if (mode === "diff") {
      const d = diffLines(root);
      if (!d) return `Mode diff butuh repo git: ${root}`;
      for (const [rel, pairs] of Object.entries(d)) { scanned++; check(rel, pairs); }
    } else {
      for (const rel of walk(root)) {
        let text;
        try {
          const st = fs.statSync(path.join(root, rel));
          if (st.size > MAX_SIZE) continue;
          text = fs.readFileSync(path.join(root, rel), "utf8");
        } catch { continue; }
        if (text.includes("\u0000")) continue;
        scanned++;
        check(rel, text.split("\n").map((t, i) => [i + 1, t]));
      }
    }

    // .env yang ikut di-commit
    const tracked = spawnSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
    if (tracked.status === 0) {
      for (const f of tracked.stdout.split("\n").filter((x) => /(^|\/)\.env(\.[\w-]+)?$/.test(x) && !/\.(example|sample|dist|testing)$/.test(x))) {
        findings.push({ sev: 0, title: "File .env ikut di-commit ke git", fix: "git rm --cached <file>, tambahkan ke .gitignore, dan ROTASI semua secret di dalamnya.", at: f, snippet: "" });
      }
    }

    findings.sort((a, b) => a.sev - b.sev);
    const count = SEV.map((s, i) => `${s} ${findings.filter((f) => f.sev === i).length}`).join(" · ");
    const lines = [`Review keamanan: ${root} (mode ${mode}) — ${scanned} file dipindai`, `Ringkasan: ${count}`, ""];
    for (const f of findings) {
      lines.push(`[${SEV[f.sev].toUpperCase()}] ${f.title} — ${f.at}`);
      if (f.snippet) lines.push(`    ${f.snippet}`);
      lines.push(`    Perbaikan: ${f.fix}`);
    }
    if (!findings.length) lines.push("Tidak ada temuan berbasis pola.");
    if (mode === "project" && input.audit_deps !== false) {
      const a = audit(root);
      if (a.length) lines.push("", "Dependency:", ...a.map((x) => "  " + x));
    }
    lines.push("", "Catatan: ini temuan berbasis pola. Verifikasi setiap temuan dengan membaca kodenya (apakah input benar dari user? sudah divalidasi/di-escape?), " +
      "buang false positive, lalu tinjau manual logika otorisasi (IDOR), rate limit, dan alur bisnis — lihat playbook security-review.");
    return lines.join("\n");
  },
};
