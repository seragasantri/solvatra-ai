// Cari memori yang relevan secara eksplisit (selain injeksi otomatis tiap giliran).
export default {
  name: "recall",
  description:
    "Cari di memori jangka panjang untuk fakta yang relevan dengan sebuah topik/kata kunci.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Topik atau kata kunci yang dicari." },
    },
    required: ["query"],
  },
  async run(input, ctx) {
    const hits = ctx.memory.search(input.query, 10);
    if (!hits.length) return "Tidak ada memori yang cocok.";
    return hits.map((m) => `- ${m.text}`).join("\n");
  },
};
