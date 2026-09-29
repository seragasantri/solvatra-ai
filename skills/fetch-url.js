// Skill: baca halaman web. Ambil URL (http/https), ekstrak teks yang terbaca dari HTML.
// Dipakai otomatis saat user memberi link dan minta dibaca/dipelajari/diringkas.

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(+n); } catch { return _; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return _; } });
}

function htmlToText(html) {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const title = ((h.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  h = h.replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n");
  h = h.replace(/<[^>]+>/g, " ");
  h = decodeEntities(h).replace(/[ \t\f\v]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return { title: decodeEntities(title), text: h };
}

export default {
  name: "fetch_url",
  description:
    "Baca sebuah halaman web: ambil URL (http/https) lalu ekstrak teks yang terbaca (judul + isi). Panggil SECARA OTOMATIS saat user memberi link dan ingin isinya dibaca/dipelajari/diringkas. Bisa juga ambil JSON/teks mentah.",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL lengkap (harus http:// atau https://)." },
      max_chars: { type: "number", description: "Batas karakter hasil (default 15000)." },
    },
    required: ["url"],
  },
  async run(input) {
    const url = String(input.url || "").trim();
    if (!/^https?:\/\//i.test(url)) return "URL harus diawali http:// atau https://";
    const max = Math.min(input.max_chars || 15000, 120000);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    let res;
    try {
      res = await fetch(url, {
        redirect: "follow",
        signal: ctrl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Solvatra/1.0; +https://github.com/seragasantri/solvatra-ai)",
          "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        },
      });
    } catch (e) {
      clearTimeout(timer);
      return `Gagal mengambil ${url}: ${e.name === "AbortError" ? "timeout (20s)" : e.message}. (Cek koneksi / URL, atau jaringan mungkin diblokir.)`;
    }
    clearTimeout(timer);

    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let raw;
    try { raw = await res.text(); } catch (e) { return `Gagal membaca isi ${url}: ${e.message}`; }

    let head = `URL: ${res.url}  ·  status ${res.status}  ·  ${ct || "?"}`;
    let body;
    if (ct.includes("application/json")) {
      try { body = JSON.stringify(JSON.parse(raw), null, 2); } catch { body = raw; }
    } else if (ct.includes("html") || /^\s*</.test(raw)) {
      const { title, text } = htmlToText(raw);
      if (title) head += `\nJudul: ${title}`;
      body = text;
    } else {
      body = raw;
    }
    if (!body || !body.trim()) return `${head}\n\n(Halaman tidak berisi teks yang bisa diekstrak — mungkin butuh JavaScript/render dinamis.)`;
    if (body.length > max) body = body.slice(0, max) + `\n\n… [dipotong; total ${body.length} char]`;
    return `${head}\n\n${body}`;
  },
};
