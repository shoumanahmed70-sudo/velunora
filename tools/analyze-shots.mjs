// يحلّل لقطات الشاشة: متوسط السطوع، نسبة البكسل الفاتح جدًا، وملف التدرّج الرأسي.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = "tools/shots";
fs.mkdirSync(dir, { recursive: true });
const files = fs.readdirSync(dir).filter((f) => /\.(jpg|jpeg|png)$/i.test(f));
if (!files.length) console.log("no shots");

for (const f of files) {
  const img = sharp(path.join(dir, f));
  const m = await img.metadata();
  const st = await img.stats();
  const bright = Math.round(st.channels.slice(0, 3).reduce((a, c) => a + c.mean, 0) / 3);

  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const total = info.width * info.height;
  let white = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum > 217) white++;
  }

  const bands = 8;
  const bandH = Math.floor(info.height / bands);
  const bandStats = [];
  for (let b = 0; b < bands; b++) {
    let s = 0, c = 0;
    for (let y = b * bandH; y < Math.min((b + 1) * bandH, info.height); y += 3) {
      for (let x = 0; x < info.width; x += 3) {
        const i = (y * info.width + x) * info.channels;
        s += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        c++;
      }
    }
    bandStats.push(Math.round(s / c));
  }

  console.log(
    f.padEnd(24),
    (m.width + "x" + m.height).padEnd(12),
    "وسط السطوع", String(bright).padStart(3),
    "| فاتح جدًا", (((white / total) * 100).toFixed(1) + "%").padStart(6),
    "| شرائح", bandStats.join(",")
  );
}
