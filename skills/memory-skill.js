// Skill memori: inilah mekanisme "makin diajak ngobrol makin pintar".
// Agent memanggil "remember" untuk menyimpan fakta tahan lama tentang user.
export default {
  name: "remember",
  description:
    "Simpan sebuah fakta tahan lama tentang user ke memori jangka panjang (nama, preferensi, proyek, tujuan, keputusan). Panggil saat mempelajari sesuatu yang berguna untuk diingat di percakapan berikutnya.",
  input_schema: {
    type: "object",
    properties: {
      fact: { type: "string", description: "Fakta ringkas & mandiri untuk diingat." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "Label opsional, mis. ['preferensi','proyek'].",
      },
    },
    required: ["fact"],
  },
  async run(input, ctx) {
    const item = ctx.memory.remember(input.fact, input.tags || []);
    if (!item) return "Tidak ada yang disimpan (fakta kosong).";
    return `Tersimpan ke memori: "${item.text}"`;
  },
};
