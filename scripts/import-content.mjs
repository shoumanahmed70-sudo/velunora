/**
 * VELUNORA — استيراد محتوى المتجر من حزمة `seeds/store-content.json`.
 *
 * الاستخدام (على الخادم مثل Render عبر Shell، أو على جهاز التطوير):
 *   npm run content:import
 *
 * يستبدل فقط بيانات المحتوى:
 *   products (المنتجات) / categories (الأقسام) / pages (الصفحات)
 *   store (هوية المتجر: الاسم/الألوان/الشحن/التواصل/SEO)
 *   home (الصفحة الرئيسية: البانرات/الأقسام/صور البطل)
 *
 * لا يمس أبدًا: العملاء، الطلبات، حسابات الأدمن، كلمات المرور،
 * الإعدادات الخاصة (واتساب/SMTP)، الجلسات، السلال، التقييمات، سجل التدقيق.
 *
 * ملاحظات:
 *  - مدعوم حاليًا للمحرّك المحلي (STORAGE_DRIVER=local) فقط.
 *  - الحزمة تُرفض أمنيًا إن احتوت أي قسم "private" أو صور رفع (/api/files/).
 *  - بعد الاستيراد، صفّر ذاكرة المحرّك بإعادة تشغيل الخدمة من لوحة Render
 *    (Manual Deploy → Restart) أو انتظر أقل من دقيقة لتنتهي صلاحية الكاش.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, driverName, readLocal, writeLocal, FILES, fail, log } from "./_shared.mjs";

loadEnv();

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const bundlePath = path.join(root, "seeds", "store-content.json");

if (driverName() !== "local") {
  fail("استيراد المحتوى مدعوم حاليًا للمحرّك المحلي (STORAGE_DRIVER=local) فقط.");
}

let bundle;
try {
  bundle = JSON.parse(fs.readFileSync(bundlePath, "utf8"));
} catch {
  fail(`تعذّر قراءة الحزمة: ${bundlePath}`);
}

if (!bundle.store || !bundle.home) fail("الحزمة ناقصة: لا يوجد قسم store/home.");
if (bundle.private) fail("الحزمة تحتوي قسم private — مرفوض لأمنية. صحّح seeds/store-content.json.");
if (JSON.stringify(bundle).includes("/api/files/")) {
  fail("الحزمة تحتوي صور رفع (var/uploads) غير موجودة في المستودع.");
}

// 1) منتجات + أقسام + صفحات
const products = Array.isArray(bundle.products) ? bundle.products : [];
const categories = Array.isArray(bundle.categories) ? bundle.categories : [];
const pages = Array.isArray(bundle.pages) ? bundle.pages : [];
writeLocal(FILES.products, products);
writeLocal(FILES.categories, categories);
writeLocal(FILES.pages, pages);

// 2) إعدادات المتجر + الرئيسية: نستبدل store/home فقط مع الحفاظ على private الموجود
//    (مطلوب وجوده مسبقًا لأن settings() في المحرّك المحلي لا تدمج الافتراضيات للملف الموجود).
const existing = readLocal(FILES.settings, null);
if (!existing) {
  fail(
    "لا يوجد var/db/settings.json بعد — شغّل المتجر مرة واحدة بإزاحة أي صفحة أولًا (أو أعد تشغيل الخدمة) ثم أعد المحاولة."
  );
}
if (!existing.private) {
  fail("ملف الإعدادات الموجود بلا قسم private — أعد تشغيل الخدمة لإنشائه بالقيم الافتراضية ثم أعد المحاولة.");
}
writeLocal(FILES.settings, {
  ...existing,
  store: bundle.store,
  home: bundle.home,
});

log("✓ تم استيراد المحتوى بنجاح:");
log(`  منتجات: ${products.length} / أقسام: ${categories.length} / صفحات: ${pages.length}`);
log("  الإعدادات العامة والصفحة الرئيسية: تم التحديث (private كما هي بدون تغيير).");
log("  الخطوة التالية: أعد تشغيل الخدمة من لوحة Render ثم اضبط رقم واتساب المالك من لوحة الأدمن.");
