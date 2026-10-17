import { getPublicStore } from "@/lib/server/catalog";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** إعدادات المتجر العامة + الأقسام + الصفحة الرئيسية + رابط واتساب Contact (الرقم لا يُكشف). */
export const GET = route(async () => {
  const store = await getPublicStore();
  return json(store);
});
