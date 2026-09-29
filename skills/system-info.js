// Skill: periksa perangkat & lingkungan tempat agent ini BERJALAN (lokal, bukan cloud).
// Read-only, aman. Dipakai untuk memastikan "di mana saya" sebelum menjawab.
import os from "node:os";

const OS_NAME = { darwin: "macOS", win32: "Windows", linux: "Linux" };

export default {
  name: "system_info",
  description:
    "Periksa perangkat & lingkungan tempat agent ini berjalan (OS, hostname, user, arch, direktori kerja, Node). Panggil ini SEBELUM menjawab pertanyaan tentang 'di mana saya berjalan', akses perangkat, atau saat diminta memperbaiki sesuatu di perangkat ini — untuk memastikan konteksnya benar.",
  input_schema: { type: "object", properties: {} },
  async run() {
    let u = {};
    try { u = os.userInfo(); } catch {}
    const info = {
      os: OS_NAME[process.platform] || process.platform,
      platform: process.platform,
      os_release: os.release(),
      arch: process.arch,
      hostname: os.hostname(),
      username: u.username || "?",
      home: os.homedir(),
      cwd: process.cwd(),
      node: process.version,
      cpus: os.cpus()?.length,
      total_mem_gb: +(os.totalmem() / 1e9).toFixed(1),
      uptime_min: Math.round(os.uptime() / 60),
      note: "Agent ini adalah program CLI yang berjalan LANGSUNG di perangkat ini (mesin lokal user), bukan di server penyedia model.",
    };
    return JSON.stringify(info, null, 2);
  },
};
