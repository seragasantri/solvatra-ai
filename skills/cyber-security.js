// Skill tunggal: Audit Keamanan (defensif, read-only). Menggabungkan:
//   - audit_code       : pindai pola kerentanan (injection, kripto lemah, TLS-off, XSS, dll)
//   - scan_secrets     : deteksi kredensial/API key ter-hardcode
//   - dependency_audit : cek manifest dependensi & saran audit resmi
import fs from "node:fs";
import path from "node:path";
import { walkFiles, CODE_EXT, mask } from "../src/sec-common.js";

const SEV_ORDER = { Critical: 0, High: 1, Medium: 2, Low: 3 };

const SECRET_RULES = [
  { id: "aws_access_key", sev: "High", re: /AKIA[0-9A-Z]{16}/ },
  { id: "google_api_key", sev: "High", re: /AIza[0-9A-Za-z\-_]{35}/ },
  { id: "slack_token", sev: "High", re: /xox[baprs]-[0-9A-Za-z-]{10,}/ },
  { id: "private_key_block", sev: "Critical", re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
  { id: "jwt", sev: "Medium", re: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { id: "generic_secret_assign", sev: "High", re: /(?:api[_-]?key|secret|token|passwd|password|access[_-]?token|private[_-]?key)\s*[:=]\s*['"][^'"\s]{8,}['"]/i },
  { id: "db_connection_pw", sev: "High", re: /(?:mysql|postgres|postgresql|mongodb(?:\+srv)?):\/\/[^:@\s]+:[^@\s]+@/i },
];

const CODE_RULES = [
  { id: "sql_injection", sev: "High", re: /(SELECT|INSERT|UPDATE|DELETE)\b[^;]*(\+\s*\w|\$\{|%\s*\(|\.format\(|f["'])/i,
    fix: "Pakai parameterized query / prepared statement." },
  { id: "command_injection", sev: "Critical", re: /(exec|execSync|spawn|system|shell_exec|popen|os\.system|subprocess\.\w+)\s*\([^)]*(\+|\$\{|`|%s)/,
    fix: "Jangan masukkan input user ke shell; gunakan argumen array & allowlist." },
  { id: "eval_usage", sev: "High", re: /\b(eval|assert)\s*\(|new\s+Function\s*\(/,
    fix: "Hindari eval/new Function pada input dinamis." },
  { id: "weak_crypto", sev: "Medium", re: /\b(md5|sha1)\b|createHash\(\s*['"](md5|sha1)['"]|DES\b/i,
    fix: "Password: bcrypt/argon2. Integritas: SHA-256+." },
  { id: "tls_verification_off", sev: "High", re: /rejectUnauthorized\s*:\s*false|verify\s*=\s*False|InsecureSkipVerify\s*:\s*true|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0/,
    fix: "Jangan matikan verifikasi TLS di produksi." },
  { id: "xss_sink", sev: "Medium", re: /dangerouslySetInnerHTML|\.innerHTML\s*=|document\.write\(|v-html/,
    fix: "Sanitasi/escape output; hindari HTML mentah dari input user." },
  { id: "cors_wildcard", sev: "Medium", re: /Access-Control-Allow-Origin['"]?\s*[:,]\s*['"]\*|origin\s*:\s*['"]\*['"]/,
    fix: "Batasi origin ke domain tepercaya, bukan '*'." },
  { id: "insecure_random_token", sev: "Low", re: /Math\.random\(\)/,
    fix: "Token: crypto.randomBytes / getRandomValues, bukan Math.random." },
  { id: "php_superglobal_sink", sev: "High", re: /\b(echo|print|include|require|system|exec)\b[^;]*\$_(GET|POST|REQUEST|COOKIE)/,
    fix: "Validasi & escape input superglobal sebelum dipakai." },
];

function scanSecrets(base, max) {
  const files = walkFiles(base, { exts: CODE_EXT });
  const hits = [];
  for (const f of files) {
    if (hits.length >= max) break;
    let c; try { c = fs.readFileSync(f, "utf8"); } catch { continue; }
    const lines = c.split("\n");
    for (let i = 0; i < lines.length && hits.length < max; i++)
      for (const r of SECRET_RULES) {
        const m = lines[i].match(r.re);
        if (m) hits.push(`[${r.sev}] ${r.id}  ${path.relative(base, f)}:${i + 1}  → ${mask(m[0])}`);
      }
  }
  if (!hits.length) return "scan_secrets: tidak ada indikasi secret ter-hardcode.";
  return `scan_secrets: ${hits.length} indikasi\n` + hits.join("\n") +
    "\nRemediasi: pindah ke env/secret manager, rotasi yang bocor, pastikan .env di .gitignore.";
}

function auditCode(base, max) {
  const files = walkFiles(base, { exts: CODE_EXT });
  const hits = [];
  for (const f of files) {
    let c; try { c = fs.readFileSync(f, "utf8"); } catch { continue; }
    const lines = c.split("\n");
    for (let i = 0; i < lines.length; i++)
      for (const r of CODE_RULES)
        if (r.re.test(lines[i]))
          hits.push({ sev: r.sev, id: r.id, loc: `${path.relative(base, f)}:${i + 1}`, snippet: lines[i].trim().slice(0, 120), fix: r.fix });
  }
  if (!hits.length) return "audit_code: tidak ada pola kerentanan umum terdeteksi (heuristik).";
  hits.sort((a, b) => SEV_ORDER[a.sev] - SEV_ORDER[b.sev]);
  const summary = ["Critical", "High", "Medium", "Low"].map((s) => `${s}: ${hits.filter((h) => h.sev === s).length}`).join("  ");
  const body = hits.slice(0, max).map((h) => `[${h.sev}] ${h.id}  ${h.loc}\n    kode: ${h.snippet}\n    fix : ${h.fix}`).join("\n");
  return `audit_code: ${hits.length} temuan (${summary})\n${body}`;
}

function dependencyAudit(base) {
  const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
  const out = [], risky = [];
  const pkg = readJSON(path.join(base, "package.json"));
  if (pkg) {
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    out.push(`package.json: ${Object.keys(deps).length} dependency (npm). Saran: \`npm audit\`.`);
    for (const [n, v] of Object.entries(deps)) {
      if (v === "*" || v === "latest") risky.push(`  [Medium] ${n}@${v} — versi tak terkunci.`);
      if (/^(git\+|https?:|github:|file:)/.test(String(v))) risky.push(`  [Medium] ${n} → ${v} — sumber non-registry.`);
    }
  }
  const comp = readJSON(path.join(base, "composer.json"));
  if (comp) out.push(`composer.json: ${Object.keys({ ...(comp.require || {}), ...(comp["require-dev"] || {}) }).length} paket (PHP). Saran: \`composer audit\`.`);
  if (fs.existsSync(path.join(base, "requirements.txt"))) out.push("requirements.txt terdeteksi (Python). Saran: `pip-audit`.");
  if (fs.existsSync(path.join(base, "go.mod"))) out.push("go.mod terdeteksi (Go). Saran: `govulncheck ./...`.");
  if (!out.length) return "dependency_audit: tidak ada manifest dependency dikenali.";
  return "dependency_audit:\n" + out.join("\n") + (risky.length ? `\nPerlu perhatian:\n${risky.slice(0, 60).join("\n")}` : "");
}

export default {
  name: "cyber_security",
  description:
    "Audit Keamanan (defensif, read-only). action: 'audit_code' (pola kerentanan: injection, auth, kripto lemah, TLS-off, XSS, dll), 'scan_secrets' (kredensial/API key ter-hardcode), 'dependency_audit' (dependensi rentan), atau 'all' (ketiganya). Hasil berupa temuan + severity + remediasi untuk disusun jadi laporan.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["audit_code", "scan_secrets", "dependency_audit", "all"], description: "Jenis audit (default 'all')." },
      dir: { type: "string", description: "Folder target (default: direktori kerja)." },
      max: { type: "number", description: "Maks temuan per bagian (default 120)." },
    },
  },
  async run(input) {
    const base = input.dir || process.cwd();
    if (!fs.existsSync(base)) return `Folder tidak ditemukan: ${base}`;
    const max = Math.min(input.max || 120, 400);
    const action = input.action || "all";
    const parts = [];
    if (action === "all" || action === "audit_code") parts.push(auditCode(base, max));
    if (action === "all" || action === "scan_secrets") parts.push(scanSecrets(base, max));
    if (action === "all" || action === "dependency_audit") parts.push(dependencyAudit(base));
    if (!parts.length) return "action tidak dikenal (audit_code|scan_secrets|dependency_audit|all).";
    return `🛡️ Audit Keamanan @ ${base}\n\n` + parts.join("\n\n────────────\n\n") +
      "\n\nCatatan: hasil heuristik/read-only; verifikasi tiap temuan sebelum laporan final.";
  },
};
