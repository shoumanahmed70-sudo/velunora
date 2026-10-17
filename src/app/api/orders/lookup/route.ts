import { getDriver } from "@/lib/store";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { getSession } from "@/lib/server/session";
import { toPublicOrder } from "@/lib/server/public-order";
import { normalizePhone, phonesMatch } from "@/lib/server/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  number?: string;
  phone?: string;
}

/**
 * جلب طلب للعميل: يتطلب رقم الطلب + رقم الجوال المطابق (تحقق مزدوج)
 * أو أن يكون الطلب مملوكًا لصاحب الجلسة الحالية.
 */
export const POST = route(async (request: Request) => {
  const limit = rateLimit(`lookup:${clientIp(request)}`, 30, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const number = (body.number || "").trim().toUpperCase();
  const phone = (body.phone || "").trim();

  if (!number || number.length > 30) throw badRequest("أدخل رقم الطلب", "validation");
  if (normalizePhone(phone).length < 8) throw badRequest("أدخل رقم الجوال", "validation");

  const db = await getDriver();
  const order = await db.getOrderByNumber(number);
  if (!order) throw notFound("لم يتم العثور على طلب بهذه البيانات");

  // الجلسة مُتحقَّق من نسختها (تُبطل بعد تغيير كلمة المرور أو تعطيل الحساب)
  const session = await getSession();
  const isOwner = Boolean(session && order.uid && session.uid === order.uid);
  const phoneMatches = phonesMatch(order.customer.phone, phone);

  if (!isOwner && !phoneMatches) throw notFound("لم يتم العثور على طلب بهذه البيانات");

  return json({ order: toPublicOrder(order) });
});
