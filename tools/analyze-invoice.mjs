import sharp from "sharp";
import fs from "node:fs";

const [src, out, x, y, w, h] = process.argv.slice(2);
const box = {
  left: Math.max(0, Math.round(Number(x))),
  top: Math.max(0, Math.round(Number(y))),
  width: Math.round(Number(w)),
  height: Math.round(Number(h)),
};

const meta = await sharp(src).metadata();
box.width = Math.min(box.width, meta.width - box.left);
box.height = Math.min(box.height, meta.height - box.top);

const buf = await sharp(src).extract(box).png().toBuffer();
if (out) fs.writeFileSync(out, buf);

// إحصاءات
const small = await sharp(buf).removeAlpha().resize({ width: 320 }).raw().toBuffer({ resolveWithObject: true });
let sum = 0, nearWhite = 0, nearBlack = 0, ink = 0;
const n = small.info.width * small.info.height;
for (let i = 0; i < small.data.length; i += small.info.channels) {
  const r = small.data[i], g = small.data[i + 1], b = small.data[i + 2];
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  sum += lum;
  if (r > 240 && g > 240 && b > 240) nearWhite++;
  if (lum < 40) nearBlack++;
}
const mean = sum / n;
let sq = 0;
for (let i = 0; i < small.data.length; i += small.info.channels) {
  const lum = 0.2126 * small.data[i] + 0.7152 * small.data[i + 1] + 0.0722 * small.data[i + 2];
  sq += (lum - mean) ** 2;
}

// نسبة "الحبر" على الدقة الكاملة (بكسل يختلف عن خلفية الصفحة)
const full = await sharp(buf).removeAlpha().greyscale().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < full.data.length; i++) if (full.data[i] < 205) ink++;

console.log(JSON.stringify({
  src: `${meta.width}x${meta.height}`,
  box,
  meanBrightness: +mean.toFixed(1),
  stdDev: +Math.sqrt(sq / n).toFixed(1),
  nearWhitePct: +((nearWhite / n) * 100).toFixed(1),
  nearBlackPct: +((nearBlack / n) * 100).toFixed(1),
  inkPct: +((ink / (full.info.width * full.info.height)) * 100).toFixed(2),
  out: out || null,
}, null, 2));

// معاينة ASCII (لتأكيد البنية بصريًا)
const AW = 58;
const ascii = await sharp(buf).removeAlpha().greyscale().resize({ width: AW }).raw().toBuffer({ resolveWithObject: true });
const ramp = " .:-=+*#%@";
const invert = mean < 110; // على الخلفية الداكنة: النص فاتح
console.log(`\n--- ASCII ${AW}x${Math.round((ascii.info.height / ascii.info.width) * AW)} (invert=${invert}) ---`);
for (let row = 0; row < ascii.info.height; row++) {
  let line = "";
  for (let col = 0; col < ascii.info.width; col++) {
    const v = ascii.data[row * ascii.info.width + col] / 255;
    const idx = invert ? Math.round((1 - v) * (ramp.length - 1)) : Math.round(v * (ramp.length - 1));
    line += ramp[Math.max(0, Math.min(ramp.length - 1, idx))];
  }
  console.log(line);
}
