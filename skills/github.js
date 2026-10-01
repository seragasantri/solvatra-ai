// Skill: Git & GitHub — status, diff, log, branch, commit, push, PR, cek CI.
// Aksi yang mengubah repo/remote (commit, push, pr_create, branch_create) minta persetujuan (mode ask).
import { spawnSync } from "node:child_process";

const MAX = 24_000;
const clip = (s) => (s.length > MAX ? s.slice(0, MAX) + `\n… (dipotong ${s.length - MAX} karakter)` : s);

function run(cmd, args, cwd, input) {
  const r = spawnSync(cmd, args, {
    cwd, input, encoding: "utf8", timeout: 120_000, maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GH_PROMPT_DISABLED: "1", PAGER: "cat", GH_PAGER: "cat", NO_COLOR: "1" },
  });
  if (r.error?.code === "ENOENT") return { ok: false, out: `${cmd} tidak terpasang di perangkat ini.` };
  const out = ((r.stdout || "") + (r.stderr ? (r.stdout ? "\n" : "") + r.stderr : "")).trim();
  return { ok: r.status === 0, out: out || "(tanpa keluaran)" };
}
const git = (args, cwd, input) => run("git", args, cwd, input);
const gh = (args, cwd) => run("gh", args, cwd);
const show = (title, r) => `${r.ok ? "" : "GAGAL: "}${title}\n${clip(r.out)}`;

const WRITE_ACTIONS = new Set(["commit", "push", "pr_create", "branch_create"]);

export default {
  name: "github",
  description:
    "Git & GitHub di repo lokal. action: status | diff (staged/unstaged; opsional path, base) | log | branch (daftar) | branch_create (name) | " +
    "commit (message, files[] — WAJIB sebut file yang di-commit; 'all' untuk semua) | push | pr_create (title, body, base) | pr_view (number opsional) | pr_list | checks (status CI PR/branch) | run_log (run_id: log job yang gagal). " +
    "Selalu status+diff sebelum commit; jangan commit .env/secret/build output.",
  input_schema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["status", "diff", "log", "branch", "branch_create", "commit", "push", "pr_create", "pr_view", "pr_list", "checks", "run_log"] },
      cwd: { type: "string", description: "Folder repo (default folder kerja)." },
      path: { type: "string", description: "diff/log: batasi ke path tertentu." },
      base: { type: "string", description: "diff: bandingkan dengan branch/commit ini (mis. main). pr_create: branch tujuan." },
      staged: { type: "boolean", description: "diff: hanya perubahan staged." },
      name: { type: "string", description: "branch_create: nama branch baru." },
      message: { type: "string", description: "commit: pesan commit (baris pertama ringkas, lalu alasan)." },
      files: { type: "array", items: { type: "string" }, description: "commit: daftar file; ['all'] untuk semua perubahan." },
      title: { type: "string" }, body: { type: "string" },
      number: { type: "string", description: "pr_view: nomor PR." },
      run_id: { type: "string", description: "run_log: id workflow run." },
      limit: { type: "number", description: "log/pr_list: jumlah entri (default 15)." },
    },
    required: ["action"],
  },
  async run(input, ctx) {
    const a = input.action;
    const cwd = input.cwd || process.cwd();
    if (WRITE_ACTIONS.has(a)) {
      if (ctx.mode === "manual") return "Mode manual aktif — aksi git yang mengubah repo/remote dimatikan.";
      const what = a === "commit" ? `git commit "${String(input.message || "").split("\n")[0]}" (${(input.files || []).join(", ") || "?"})`
        : a === "push" ? "git push ke remote" : a === "pr_create" ? `buat PR "${input.title || ""}"` : `buat branch ${input.name}`;
      if (typeof ctx.confirm === "function") { if (!(await ctx.confirm(what))) return "Dibatalkan oleh user."; }
      else if (process.env.SOLVATRA_ALLOW_WRITE !== "1") return "Aksi ini butuh konfirmasi interaktif atau SOLVATRA_ALLOW_WRITE=1.";
    }
    const inRepo = git(["rev-parse", "--show-toplevel"], cwd);
    if (!inRepo.ok) return `Bukan repo git: ${cwd}`;
    const n = String(Math.min(Math.max(Number(input.limit) || 15, 1), 100));

    switch (a) {
      case "status": {
        const b = git(["status", "-sb"], cwd);
        const last = git(["log", "--oneline", "-5"], cwd);
        return `${show("git status -sb", b)}\n\n${show("commit terakhir", last)}`;
      }
      case "diff": {
        const args = ["diff", "--stat", "-p"];
        if (input.staged) args.splice(1, 0, "--cached");
        if (input.base) args.push(`${input.base}...HEAD`);
        if (input.path) args.push("--", input.path);
        const d = git(args, cwd);
        const untracked = input.base || input.staged ? null : git(["ls-files", "--others", "--exclude-standard"], cwd);
        return show(`git ${args.join(" ")}`, d) + (untracked?.out && untracked.out !== "(tanpa keluaran)" ? `\n\nFile baru (untracked):\n${untracked.out}` : "");
      }
      case "log": return show("git log", git(["log", "--oneline", "--decorate", `-${n}`, ...(input.path ? ["--", input.path] : [])], cwd));
      case "branch": return show("git branch", git(["branch", "-vv", "--sort=-committerdate"], cwd));
      case "branch_create": {
        if (!input.name) return "Butuh name.";
        return show(`git switch -c ${input.name}`, git(["switch", "-c", input.name], cwd));
      }
      case "commit": {
        if (!input.message) return "Butuh message.";
        const files = input.files || [];
        if (!files.length) return "Sebutkan files yang di-commit (atau ['all']). Cek dulu dengan action status/diff.";
        const add = files.includes("all") ? git(["add", "-A"], cwd) : git(["add", "--", ...files], cwd);
        if (!add.ok) return show("git add", add);
        const staged = git(["diff", "--cached", "--name-only"], cwd).out;
        const risky = staged.split("\n").filter((f) => /(^|\/)\.env(\.|$)|\.pem$|id_rsa|\.p12$|\.key$/.test(f));
        if (risky.length) {
          git(["reset", "-q", "--", ...risky], cwd);
          return `DITOLAK: file berisi secret ikut ter-stage (${risky.join(", ")}) — sudah dikeluarkan dari stage. Commit ulang tanpa file itu.`;
        }
        return show("git commit", git(["commit", "-F", "-"], cwd, input.message));
      }
      case "push": {
        const br = git(["rev-parse", "--abbrev-ref", "HEAD"], cwd).out;
        const up = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], cwd);
        return show(`git push (${br})`, up.ok ? git(["push"], cwd) : git(["push", "-u", "origin", br], cwd));
      }
      case "pr_create": {
        if (!input.title) return "Butuh title.";
        const args = ["pr", "create", "--title", input.title, "--body", input.body || ""];
        if (input.base) args.push("--base", input.base);
        return show("gh pr create", gh(args, cwd));
      }
      case "pr_view": return show("gh pr view", gh(["pr", "view", ...(input.number ? [String(input.number)] : []), "--comments"], cwd));
      case "pr_list": return show("gh pr list", gh(["pr", "list", "--limit", n], cwd));
      case "checks": {
        const pr = gh(["pr", "checks"], cwd);
        if (pr.ok || /fail|pass|pending/i.test(pr.out)) return show("gh pr checks", pr);
        return show("gh run list", gh(["run", "list", "--limit", "10"], cwd));
      }
      case "run_log": {
        if (!input.run_id) return "Butuh run_id (lihat action checks).";
        return show(`gh run view ${input.run_id} --log-failed`, gh(["run", "view", String(input.run_id), "--log-failed"], cwd));
      }
      default: return `Action tidak dikenal: ${a}`;
    }
  },
};
