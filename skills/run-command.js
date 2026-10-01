// Skill: jalankan perintah shell di perangkat user dan SELALU kembalikan hasilnya
// (exit code + output), dengan batas waktu. Mendukung sudo: password diminta sekali
// per sesi lewat input tersembunyi, disimpan di memori saja, tidak pernah dikirim ke model.
import { spawn, spawnSync } from "node:child_process";

const MAX_OUT = 30_000;
let sudoPassword = null; // hanya di memori proses ini

const isWin = process.platform === "win32";
const usesSudo = (cmd) => !isWin && /(^|[\s;&|(`$])sudo(\s|$)/.test(cmd);
const sudoNoPassword = () => spawnSync("sudo", ["-n", "true"], { stdio: "ignore", timeout: 5000 }).status === 0;
const sudoCheck = (pw) =>
  spawnSync("sudo", ["-S", "-p", "", "-v"], { input: pw + "\n", stdio: ["pipe", "ignore", "ignore"], timeout: 10000 }).status === 0;

function clip(s) {
  if (s.length <= MAX_OUT) return s;
  return s.slice(0, 8000) + `\n… (${s.length - MAX_OUT} karakter dipotong) …\n` + s.slice(-(MAX_OUT - 8000));
}

export default {
  name: "run_command",
  description:
    "Jalankan perintah shell di perangkat user (bash di Linux/macOS, cmd di Windows) dan dapatkan exit code + output-nya. " +
    "Pakai untuk diagnosa & perbaikan: cek service, baca log, nginx -t, systemctl, git, npm, php artisan, dll. " +
    "sudo didukung (password diminta sekali ke user bila perlu). Perintah interaktif tidak didukung — pakai flag non-interaktif (-y, --force, --no-pager). " +
    "Jangan menyuruh user menjalankan perintah yang bisa kamu jalankan sendiri dengan tool ini.",
  input_schema: {
    type: "object",
    properties: {
      command: { type: "string", description: "Perintah lengkap, boleh memakai && | ; dan sudo." },
      cwd: { type: "string", description: "Folder kerja (opsional, default folder saat ini)." },
      timeout_sec: { type: "number", description: "Batas waktu detik (default 120, maks 900)." },
    },
    required: ["command"],
  },
  async run(input, ctx) {
    const command = String(input.command || "").trim();
    if (!command) return "Error: butuh command.";
    if (ctx.mode === "manual") return "Mode manual aktif — perintah tidak dijalankan. Jelaskan perintah yang disarankan saja.";
    const timeoutMs = Math.min(Math.max(Number(input.timeout_sec) || 120, 1), 900) * 1000;
    const cwd = input.cwd ? String(input.cwd) : process.cwd();

    if (typeof ctx.confirm === "function") {
      if (!(await ctx.confirm(`Jalankan perintah: ${command.length > 240 ? command.slice(0, 240) + "…" : command}`))) {
        return "Dibatalkan oleh user.";
      }
    } else if (process.env.SOLVATRA_ALLOW_WRITE !== "1") {
      return "run_command butuh konfirmasi interaktif atau SOLVATRA_ALLOW_WRITE=1.";
    }

    // sudo: tanpa password (NOPASSWD) jalan langsung; selain itu minta password sekali per sesi.
    const env = { ...process.env, CI: "1", DEBIAN_FRONTEND: "noninteractive", GIT_TERMINAL_PROMPT: "0", PAGER: "cat", SYSTEMD_PAGER: "cat", SYSTEMD_COLORS: "0" };
    let script = command;
    if (usesSudo(command) && !sudoNoPassword()) {
      for (let attempt = 0; !sudoPassword && attempt < 3; attempt++) {
        if (typeof ctx.askSecret !== "function") {
          return "ERROR: perintah butuh sudo dan password tidak bisa diminta di sesi non-interaktif. Jalankan agent di terminal interaktif.";
        }
        const pw = await ctx.askSecret(`Password sudo untuk ${process.env.USER || "user"} (hanya disimpan di memori sesi ini)`);
        if (pw == null || pw === "") return "Dibatalkan: password sudo tidak diisi.";
        if (sudoCheck(pw)) sudoPassword = pw;
        else ctx.notice?.("Password sudo salah, coba lagi.");
      }
      if (!sudoPassword) return "ERROR: password sudo salah 3 kali — perintah tidak dijalankan.";
      env.SOLVATRA_SUDO_PW = sudoPassword;
      // setiap `sudo` di dalam perintah membaca password dari variabel lingkungan, bukan dari terminal
      script = `sudo() { printf '%s\\n' "$SOLVATRA_SUDO_PW" | command sudo -S -p '' "$@"; }\n${command}`;
    }

    const started = Date.now();
    return await new Promise((resolve) => {
      const child = isWin
        ? spawn(command, { cwd, env, shell: true, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
        : spawn("bash", ["-c", script], { cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let killedBy = null;
      const onData = (d) => {
        const s = d.toString();
        out += s;
        if (out.length > MAX_OUT * 4) out = out.slice(-MAX_OUT * 2);
        const last = s.trim().split("\n").pop();
        if (last) ctx.progress?.(last);
      };
      child.stdout.on("data", onData);
      child.stderr.on("data", onData);
      const kill = (why) => {
        killedBy = why;
        try { isWin ? child.kill() : process.kill(-child.pid, "SIGKILL"); } catch { try { child.kill("SIGKILL"); } catch {} }
      };
      const timer = setTimeout(() => kill(`batas waktu ${timeoutMs / 1000} dtk`), timeoutMs);
      const onAbort = () => kill("dibatalkan user");
      ctx.signal?.addEventListener("abort", onAbort, { once: true });
      child.on("error", (e) => { out += `\n${e.message}`; });
      child.on("close", (code) => {
        clearTimeout(timer);
        ctx.signal?.removeEventListener("abort", onAbort);
        const secs = ((Date.now() - started) / 1000).toFixed(1);
        let text = clip(out.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, "")).trimEnd();
        if (sudoPassword) text = text.split(sudoPassword).join("****");
        const head = killedBy
          ? `Dihentikan (${killedBy}) setelah ${secs} dtk`
          : code === 0 ? `Selesai (exit 0, ${secs} dtk)` : `Gagal (exit ${code}, ${secs} dtk)`;
        resolve(`${head}\n$ ${command}\n${text || "(tanpa keluaran)"}`);
      });
    });
  },
};
