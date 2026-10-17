import { getPublicStore } from "@/lib/server/catalog";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * إعدادات المتجر العامة + الأقسام + الصفحة الرئيسية + رابط تواصل واتساب.
 * ملاحظة: كائن الإعدادات الخاصة (بما فيه رقم واتساب الخام وإعدادات SMTP) لا يُرسل
 * للواجهة إطلاقًا. الرابط الوحيد المكشوف هو `contactWaUrl` الجاهز، وهو يتضمّن الرقم
 * بطبيعته داخل رابط wa.me (لأن واتساب يحتاجه)، فلا يُذكر الرقم كحقل منفصل.
 */
export const GET = route(async () => {
  const store = await getPublicStore();
  return json(store);
});
