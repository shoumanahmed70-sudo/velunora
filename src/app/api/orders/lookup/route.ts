import { getDriver } from "@/lib/store";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { getSession } from "@/lib/server/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  number?: string;
  phone?: string;
}

function lastDigitsPhone(value: string): string {
  const digits = (value || "").replace(/\D/g, "");
  return digits.slice(-9);
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
  if (phone.replace(/\D/g, "").length < 8) throw badRequest("أدخل رقم الجوال", "validation");

  const db = await getDriver();
  const order = await db.getOrderByNumber(number);
  if (!order) throw notFound("لم يتم العثور على طلب بهذه البيانات");

  const session = await getSession();
  const isOwner = Boolean(session && order.uid && session.uid === order.uid);
  const phoneMatches = lastDigitsPhone(order.customer.phone) === lastDigitsPhone(phone);

  if (!isOwner && !phoneMatches) throw notFound("لم يتم العثور على طلب بهذه البيانات");

  return json({ order });
});
