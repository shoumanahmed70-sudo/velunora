/**
 * VELUNORA — تعبئة منتجات تجريبية (صور WebP حقيقية مولّدة، ليست روابط مكسورة).
 *
 * الاستخدام:
 *   npm run seed             # يضيف المنتجات الناقصة فقط
 *   npm run seed -- --force  # يستبدل المنتجات التي تحمل نفس الـ slug
 *
 * ملاحظات:
 *  - لا يُنشئ أي طلبات وهمية (الطلبات تبقى فارغة حتى يُنشئها العميل فعليًا).
 *  - الصور تُولَّد كملفات WebP داخل public/brand/products وتُخدَم من نفس النطاق.
 *  - بعد التعبئة يمكن للمالك تعديل الأسعار/الصور من لوحة الإدارة أو حذفها.
 */

import fs from "node:fs";
import path from "node:path";
import { FILES, getFirebaseAdmin, loadEnv, parseArgs, readLocal, writeLocal, slugify, driverName, log, fail } from "./_shared.mjs";

loadEnv();
const args = parseArgs();
const force = args.force === true;
const ART_DIR = path.join(process.cwd(), "public", "brand", "products");

/* ============================ فن الزجاجة (SVG → WebP) ============================ */

function bottleSvg({ label, accent, accent2 }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1a1029"/>
      <stop offset="0.55" stop-color="#2d1b4e"/>
      <stop offset="1" stop-color="#160c24"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">
      <stop offset="0" stop-color="${accent}" stop-opacity="0.55"/>
      <stop offset="1" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${accent}"/>
      <stop offset="0.5" stop-color="${accent2}"/>
      <stop offset="1" stop-color="${accent}"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e8cf95"/>
      <stop offset="0.5" stop-color="#c6a15b"/>
      <stop offset="1" stop-color="#9a7736"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="url(#bg)"/>
  <rect width="900" height="1200" fill="url(#glow)"/>
  <ellipse cx="450" cy="1085" rx="250" ry="34" fill="#000" opacity="0.35"/>
  <!-- cap -->
  <rect x="392" y="196" width="116" height="150" rx="16" fill="url(#gold)"/>
  <rect x="404" y="176" width="92" height="40" rx="12" fill="#b8935a"/>
  <!-- neck -->
  <rect x="424" y="330" width="52" height="70" fill="${accent2}"/>
  <!-- body -->
  <rect x="300" y="392" width="300" height="560" rx="56" fill="url(#glass)"/>
  <rect x="322" y="414" width="256" height="516" rx="44" fill="#ffffff" opacity="0.06"/>
  <rect x="336" y="430" width="60" height="470" rx="30" fill="#ffffff" opacity="0.14"/>
  <!-- plate -->
  <rect x="352" y="620" width="196" height="150" rx="12" fill="#120a1e" opacity="0.55" stroke="url(#gold)" stroke-width="3"/>
  <text x="450" y="690" text-anchor="middle" font-family="Georgia, serif" font-size="40" letter-spacing="6" fill="#e8cf95">VELUNORA</text>
  <line x1="392" y1="712" x2="508" y2="712" stroke="#c6a15b" stroke-width="2"/>
  <text x="450" y="752" text-anchor="middle" font-family="Georgia, serif" font-size="24" letter-spacing="3" fill="#f7f1e7" opacity="0.9">${label}</text>
</svg>`;
}

const PALETTES = [
  ["#7c5cc4", "#4a2f7a"],
  ["#c07a5b", "#7a3f2a"],
  ["#5b8cc0", "#2a4a7a"],
  ["#c0a45b", "#7a652a"],
  ["#b05b8c", "#7a2a5a"],
  ["#5bc0a4", "#2a7a65"],
  ["#8c5bc0", "#4a2a7a"],
  ["#c05b5b", "#7a2a2a"],
];

async function generateArt(slug, label, palette) {
  fs.mkdirSync(ART_DIR, { recursive: true });
  const svg = bottleSvg({ label, accent: palette[0], accent2: palette[1] });
  const webpPath = path.join(ART_DIR, `${slug}.webp`);
  const svgPath = path.join(ART_DIR, `${slug}.svg`);
  try {
    const sharp = (await import("sharp")).default;
    await sharp(Buffer.from(svg), { density: 220 }).resize(900, 1200).webp({ quality: 86 }).toFile(webpPath);
    return `/brand/products/${slug}.webp`;
  } catch (error) {
    // احتياطي: ملف SVG يعمل كصورة صحيحة (ليس رابطًا مكسورًا)
    log(`تعذّر تحويل sharp، سيُستخدم SVG للمنتج ${slug}: ${error instanceof Error ? error.message : error}`);
    fs.writeFileSync(svgPath, svg, "utf8");
    return `/brand/products/${slug}.svg`;
  }
}

/* ============================ المنتجات ============================ */

const CATALOG = [
  {
    name: "عود الليل الملكي",
    nameEn: "Royal Night Oud",
    description: "عود كمبودي فاخر بلمسة من العنبر والمسك، يمنح حضورًا دافئًا يدوم طويلًا.",
    descriptionEn: "A luxurious Cambodian oud with amber and musk, warm and long lasting.",
    category: "men",
    price: 420,
    compareAtPrice: 520,
    featured: true,
    isNew: false,
    onSale: true,
    order: 1,
  },
  {
    name: "ياسمين الحرير",
    nameEn: "Silk Jasmine",
    description: "ياسمين نقي مع زهر البرتقال والفانيلا، أنثوي ناعم يناسب المناسبات.",
    descriptionEn: "Pure jasmine with orange blossom and vanilla, soft and feminine.",
    category: "women",
    price: 360,
    compareAtPrice: null,
    featured: true,
    isNew: true,
    onSale: false,
    order: 2,
  },
  {
    name: "مسك الغروب",
    nameEn: "Sunset Musk",
    description: "مسك أبيض مع أخشاب الصندل والباتشولي، عطر يونيسكس متوازن.",
    descriptionEn: "White musk with sandalwood and patchouli, a balanced unisex scent.",
    category: "unisex",
    price: 300,
    compareAtPrice: 380,
    featured: true,
    isNew: false,
    onSale: true,
    order: 3,
  },
  {
    name: "ندى الفجر",
    nameEn: "Dawn Dew",
    description: "حمضيات منعشة مع النيرولي والمسك، خفيف ومناسب للنهار.",
    descriptionEn: "Fresh citrus with neroli and musk, light and perfect for daytime.",
    category: "unisex",
    price: 275,
    compareAtPrice: null,
    featured: false,
    isNew: true,
    onSale: false,
    order: 4,
  },
  {
    name: "عنبر السلطان",
    nameEn: "Sultan Amber",
    description: "عنبر شرقي غني مع التوابل والجلد، عطر رجالي جذاب للمساء.",
    descriptionEn: "Rich oriental amber with spices and leather, an alluring evening scent.",
    category: "men",
    price: 480,
    compareAtPrice: null,
    featured: true,
    isNew: false,
    onSale: false,
    order: 5,
  },
  {
    name: "ورد دمشقي",
    nameEn: "Damask Rose",
    description: "ورد دمشقي أصيل مع العود الخفيف والمسك، كلاسيكي فاخر.",
    descriptionEn: "Authentic Damask rose with light oud and musk, a classic luxury.",
    category: "women",
    price: 540,
    compareAtPrice: 640,
    featured: true,
    isNew: false,
    onSale: true,
    order: 6,
  },
  {
    name: "بخور العنبر",
    nameEn: "Amber Bakhoor",
    description: "مزيج بخوري دافئ من العنبر والراتنجات، مثالي للأجواء الشتوية.",
    descriptionEn: "A warm bakhoor blend of amber and resins, ideal for winter.",
    category: "unisex",
    price: 320,
    compareAtPrice: null,
    featured: false,
    isNew: true,
    onSale: false,
    order: 7,
  },
  {
    name: "زهر اللافندر",
    nameEn: "Lavender Bloom",
    description: "لافندر هادئ مع الميرمية والأخشاب البيضاء، نقي ومريح.",
    descriptionEn: "Calm lavender with sage and white woods, clean and comforting.",
    category: "women",
    price: 290,
    compareAtPrice: 340,
    featured: false,
    isNew: false,
    onSale: true,
    order: 8,
  },
];

function buildProduct(entry, index, image) {
  const now = Date.now() - index * 1000;
  const slug = slugify(entry.nameEn || entry.name);
  const sizes = [
    { label: "30 مل", labelEn: "30 ml", factor: 0.62 },
    { label: "50 مل", labelEn: "50 ml", factor: 0.82 },
    { label: "100 مل", labelEn: "100 ml", factor: 1 },
  ];
  const round = (n) => Math.round(n * 100) / 100;
  return {
    id: `prd_${slug}`,
    slug,
    name: entry.name,
    nameEn: entry.nameEn,
    description: entry.description,
    descriptionEn: entry.descriptionEn,
    category: entry.category,
    images: [image],
    price: entry.price,
    compareAtPrice: entry.compareAtPrice,
    variants: sizes.map((s) => ({
      id: `${slug}-${s.labelEn.replace(/\s/g, "")}`,
      label: s.label,
      labelEn: s.labelEn,
      price: round(entry.price * s.factor),
      compareAtPrice: entry.compareAtPrice ? round(entry.compareAtPrice * s.factor) : null,
      stock: 25,
    })),
    options: [
      { label: "التركيز", labelEn: "Concentration", values: ["Eau de Parfum", "Eau de Toilette"] },
    ],
    stock: 75,
    featured: entry.featured,
    active: true,
    order: entry.order,
    isNew: entry.isNew,
    onSale: entry.onSale,
    createdAt: now,
    updatedAt: now,
  };
}

async function buildAll() {
  const products = [];
  for (let i = 0; i < CATALOG.length; i += 1) {
    const entry = CATALOG[i];
    const slug = slugify(entry.nameEn || entry.name);
    const image = await generateArt(slug, entry.nameEn.split(" ")[0].toUpperCase(), PALETTES[i % PALETTES.length]);
    products.push(buildProduct(entry, i, image));
  }
  return products;
}

const driver = driverName();
log(`محرّك التخزين: ${driver}`);
log("جارٍ توليد صور المنتجات (WebP)…");
const products = await buildAll();
log(`تم توليد ${products.length} منتجًا مع صوره.`);

if (driver === "firebase") {
  const { db } = await getFirebaseAdmin();
  let created = 0;
  for (const product of products) {
    const ref = db.collection("products").doc(product.id);
    const existing = await ref.get();
    if (existing.exists && !force) continue;
    await ref.set(product, { merge: true });
    created += 1;
  }
  log(`Firebase: أُضيف/حُدّث ${created} منتجًا.`);
} else {
  const existing = readLocal(FILES.products, []);
  const bySlug = new Map(existing.map((p) => [p.slug, p]));
  let created = 0;
  let updated = 0;
  for (const product of products) {
    if (bySlug.has(product.slug)) {
      if (!force) continue;
      const old = bySlug.get(product.slug);
      bySlug.set(product.slug, { ...product, id: old.id, createdAt: old.createdAt, updatedAt: Date.now() });
      updated += 1;
    } else {
      bySlug.set(product.slug, product);
      created += 1;
    }
  }
  writeLocal(FILES.products, [...bySlug.values()]);
  const meta = readLocal(FILES.meta, { orderCounter: 0, idem: {}, seeded: false });
  writeLocal(FILES.meta, { ...meta, seeded: true });
  log(`المحرّك المحلي: أُضيف ${created} وحُدّث ${updated}. الإجمالي الآن ${bySlug.size}.`);
}

log("اكتملت التعبئة. يمكنك الآن تشغيل المتجر: npm run dev");
