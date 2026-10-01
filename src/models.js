// Pemilih model Solvatra berlabel kesehatan: ⭐ rekomendasi, ✓ stabil, ⚠ kurang stabil,
// ✗ gangguan, • belum teruji. Semua tetap bisa dipilih — pemakai yang memutuskan.
import { select } from "./select.js";
import { listModelHealth } from "./auth.js";

export const STATUS = {
  stable: { icon: "✓", label: "stabil" },
  unstable: { icon: "⚠", label: "kurang stabil" },
  unavailable: { icon: "✗", label: "sedang gangguan" },
  unknown: { icon: "•", label: "belum teruji" },
};

export function describe(m, C = {}) {
  const dim = C.dim || ((s) => s), green = C.green || ((s) => s), yellow = C.yellow || ((s) => s), red = C.red || ((s) => s);
  const st = STATUS[m.status] || STATUS.unknown;
  const color = m.status === "stable" ? green : m.status === "unstable" ? yellow : m.status === "unavailable" ? red : dim;
  const parts = [color(`${st.icon} ${st.label}`)];
  if (m.recommended) parts.unshift(green("⭐ rekomendasi"));
  if (m.reason && m.status !== "stable" && m.reason !== st.label) parts.push(dim(m.reason));
  else if (m.latencyMs) parts.push(dim(`~${(m.latencyMs / 1000).toFixed(1)} dtk`));
  return parts.join(dim(" · "));
}

/**
 * Tampilkan menu pilih model. -> id model terpilih, atau null bila batal.
 * Memilih model yang sedang gangguan diminta konfirmasi dulu.
 */
export async function pickModel(rl, { C = {}, current = null, title = "Pilih model", models = null } = {}) {
  const list = models || (await listModelHealth());
  if (!list.length) return null;
  const idx = await select(rl, {
    C,
    title: "\n  " + (C.bold ? C.bold(title) : title) + (C.dim ? C.dim("  (⭐ disarankan: stabil & terbukti bisa memanggil tool)") : ""),
    options: list.map((m) => ({ label: m.id + (m.id === current ? "  ● aktif" : ""), hint: describe(m, C) })),
    initial: Math.max(0, list.findIndex((m) => m.id === current)),
    hint: "↑/↓ pilih · Enter pakai model ini · Esc batal",
  });
  if (idx < 0) return null;
  const chosen = list[idx];
  if (chosen.status === "unavailable") {
    const ok = await select(rl, {
      C,
      title: (C.yellow ? C.yellow : (s) => s)(`  ${chosen.id} sedang gangguan (${chosen.reason || "gagal diuji"}). Tetap pakai?`),
      options: ["Tidak, pilih model lain", "Ya, tetap pakai"],
    });
    if (ok !== 1) return pickModel(rl, { C, current, title, models: list });
  }
  return chosen.id;
}

/** Model terbaik untuk default: rekomendasi pertama, lalu stabil, lalu yang belum teruji. */
export function bestModel(list) {
  return (list.find((m) => m.recommended) || list.find((m) => m.status === "stable") ||
    list.find((m) => m.status === "unknown") || list.find((m) => m.status === "unstable") || list[0])?.id || null;
}
