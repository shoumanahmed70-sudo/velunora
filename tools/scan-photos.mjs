// يمسح مجموعة مرشّحات، يرتّبها حسب الملاءمة كخلفيات (عرضية + غامقة)،
// ثم يحمّل الأفضل بدقة عالية ويجهّز نسخ WebP + لوحة مقارنة.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ids = fs.readFileSync(path.join("tools", "imgtest", "ids-all.txt"), "utf8").split(/\s+/).filter(Boolean);
const SCAN = path.join("tools", "imgtest", "scan");
const CAND = path.join("tools", "imgtest", "cand");
fs.mkdirSync(SCAN, { recursive: true });
fs.mkdirSync(CAND, { recursive: true });

const cdn = (id, w) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

async function get(url, file) {
  if (fs.existsSync(file)) return true;
  try {
    const r = await fetch(url);
    if (!r.ok) return false;
    fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

// ---------- مرحلة 1: فحص سريع ----------
const scanIds = ids.slice(0, 96);
const q = [...scanIds];
const rows = [];
async function worker() {
  while (q.length) {
    const id = q.shift();
    const f = path.join(SCAN, `${id}.jpg`);
    if (!(await get(cdn(id, 640), f))) continue;
    try {
      const img = sharp(f);
      const m = await img.metadata();
      const st = await img.stats();
      const bright = Math.round(st.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3);
      rows.push({ id, w: m.width, h: m.height, bright, land: m.width > m.height });
    } catch {}
  }
}
await Promise.all(Array.from({ length: 10 }, worker));
console.log("scanned:", rows.length);

const darkLand = rows.filter((r) => r.land).sort((a, b) => a.bright - b.bright);
const midLand = rows.filter((r) => r.land && r.bright >= 80).sort((a, b) => a.bright - b.bright);
console.log("landscape total:", rows.filter((r) => r.land).length);
console.table(darkLand.slice(0, 10).map((r) => ({ id: r.id, bright: r.bright, size: `${r.w}x${r.h}` })));

// ---------- مرحلة 2: تحميل الأفضل بدقة عالية ----------
const picks = [...new Set([...darkLand.slice(0, 8).map((r) => r.id), ...midLand.slice(0, 4).map((r) => r.id)])];
const meta = [];
const q2 = [...picks];
async function worker2() {
  while (q2.length) {
    const id = q2.shift();
    const raw = path.join(CAND, `raw-${id}.jpg`);
    const out = path.join(CAND, `cand-${id}.webp`);
    if (!(await get(cdn(id, 2400), raw))) continue;
    const m = await sharp(raw).metadata();
    await sharp(raw).resize({ width: 1920, withoutEnlargement: true }).webp({ quality: 82 }).toFile(out);
    const row = rows.find((r) => r.id === id) || {};
    meta.push({ id, bright: row.bright, size: `${m.width}x${m.height}`, file: out, kb: Math.round(fs.statSync(out).size / 1024) });
  }
}
await Promise.all(Array.from({ length: 4 }, worker2));
fs.writeFileSync(path.join("tools", "imgtest", "picks.json"), JSON.stringify(meta, null, 2));

// ---------- مرحلة 3: لوحة مقارنة ----------
const COLS = 4, TW = 380, TH = 240, LABEL = 26, PAD = 6;
const cellW = TW + PAD * 2, cellH = TH + LABEL + PAD * 2;
const n = meta.length;
const W = COLS * cellW, H = Math.ceil(n / COLS) * cellH;
const comps = [];
for (let i = 0; i < n; i++) {
  const r = meta[i];
  const cx = (i % COLS) * cellW + PAD, cy = Math.floor(i / COLS) * cellH + PAD;
  comps.push({ input: await sharp(r.file).resize(TW, TH, { fit: "cover" }).toBuffer(), left: cx, top: cy });
  comps.push({
    input: Buffer.from(`<svg width="${TW}" height="${LABEL}"><rect width="${TW}" height="${LABEL}" fill="#1b0f2e"/>
      <text x="6" y="18" font-family="Segoe UI" font-size="15" fill="#e7d3a3">#${i} · ${r.id} · سطوع ${r.bright}</text></svg>`),
    left: cx, top: cy + TH,
  });
}
await sharp({ create: { width: W, height: H, channels: 3, background: "#0d0716" } })
  .composite(comps).jpeg({ quality: 88 }).toFile(path.join("tools", "imgtest", "sheet-dark.jpg"));
console.log("sheet:", path.resolve("tools/imgtest/sheet-dark.jpg"));
console.table(meta.map((m, i) => ({ "#": i, id: m.id, bright: m.bright, size: m.size, kb: m.kb })));
