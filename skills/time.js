// Tanggal & waktu sekarang.
export default {
  name: "get_time",
  description: "Dapatkan tanggal dan waktu saat ini. Bisa tentukan zona waktu (mis. 'Asia/Jakarta').",
  input_schema: {
    type: "object",
    properties: {
      timezone: { type: "string", description: "IANA timezone, default Asia/Jakarta." },
    },
  },
  async run(input) {
    const tz = input.timezone || "Asia/Jakarta";
    try {
      const now = new Date().toLocaleString("id-ID", {
        timeZone: tz,
        dateStyle: "full",
        timeStyle: "long",
      });
      return `${now} (${tz})`;
    } catch {
      return `Zona waktu "${tz}" tidak dikenal. Waktu UTC sekarang: ${new Date().toISOString()}`;
    }
  },
};
