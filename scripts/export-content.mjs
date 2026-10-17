/**
 * VELUNORA — تصدير محتوى المتجر (تصميم + منتجات) لحزمة قابلة للنقل.
 *
 * الاستخدام (على جهاز التطوير حيث يوجد var/db):
 *   npm run content:export
 *
 * يخرِج `seeds/store-content.json` الذي يحتوي:
 *   store  → إعدادات المتجر العامة (الهوية/الألوان/الشحن/التواصل/SEO)
 *   home   → الصفحة الرئيسية (البطل/البانرات/الأقسام)
 *   categories, products, pages
 *
 * لا يتضمن: العملاء، الطلبات، كلمات المرور، الإعدادات الخاصة (واتساب/SMTP)،
 * الجلسات، السلال، التقييمات، أو سجل التدقيق — أي شيء سرّي أو شخصي.
 * الصور كلها من `public/brand/*` الموجودة في المستودع نفسه.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./_shared.mjs";

loadEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const dbDir = path.join(root, "var", "db");
const outDir = path.join(root, "seeds");
const outFile = path.join(outDir, "store-content.json");

function readJson(name, fallback) {
  const file = path.join(dbDir, name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

const settingsFile = readJson("settings.json", null);
if (!settingsFile) {
  console.error("✗ لا يوجد var/db/settings.json — شغّل المتجر أولًا (npm run dev) ثم أعد المحاولة.");
  process.exit(1);
}

// settings.json في المحرّك المحلي يحتوي { store, private, home } — نأخذ store و home فقط
const bundle = {
  exportedBy: "scripts/export-content.mjs",
  exportedAt: new Date().toISOString(),
  store: settingsFile.store ?? null,
  home: settingsFile.home ?? null,
  categories: readJson("categories.json", []),
  products: readJson("products.json", []),
  pages: readJson("pages.json", []),
};

if (!bundle.store || !bundle.home) {
  console.error("✗ ملف settings.json بلا قسمين store/home — تنسيق غير متوقع.");
  process.exit(1);
}

// أمان إضافي: لا يُسمح بأن يتضمن الـ bundle أي مسار رفع ديناميكي (/api/files/)
const raw = JSON.stringify(bundle);
if (raw.includes("/api/files/")) {
  console.error("✗ المحتوى يحتوي صور رفع (var/uploads) غير متوفرة في المستودع؛ انقلها إلى public/brand أولًا.");
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2) + "\n", "utf8");

console.log(`✓ تم تصدير المحتوى إلى seeds/store-content.json`);
console.log(`  store ✓ home ✓ categories=${bundle.categories.length} products=${bundle.products.length} pages=${bundle.pages.length}`);
