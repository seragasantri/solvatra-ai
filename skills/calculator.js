// Kalkulator aritmetika aman (tanpa eval bebas). Hanya angka & operator dasar.
export default {
  name: "calculator",
  description: "Hitung ekspresi aritmetika, mis. '(12+5)*3/2'. Operator: + - * / % ** dan tanda kurung.",
  input_schema: {
    type: "object",
    properties: {
      expression: { type: "string", description: "Ekspresi aritmetika." },
    },
    required: ["expression"],
  },
  async run(input) {
    const expr = String(input.expression || "");
    if (!/^[\d\s.+\-*/%()]*\*{0,2}[\d\s.+\-*/%()]*$/.test(expr) || /[^\d\s.+\-*/%()]/.test(expr)) {
      return "Ekspresi ditolak: hanya angka dan operator + - * / % ** ( ) yang diizinkan.";
    }
    try {
      // Aman: string sudah divalidasi hanya berisi angka & operator aritmetika.
      const result = Function(`"use strict"; return (${expr});`)();
      if (typeof result !== "number" || !Number.isFinite(result)) return "Hasil bukan angka valid.";
      return String(result);
    } catch (e) {
      return `Ekspresi tidak valid: ${e.message}`;
    }
  },
};
