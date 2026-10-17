import { getDriver } from "@/lib/store";
import { getSession } from "@/lib/server/session";
import { sendMail } from "@/lib/server/mailer";
import { buildInvoiceHtml, buildInvoiceText } from "@/lib/server/invoice";
import { asString, json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  number?: string;
  phone?: string;
  email?: string;
}

function lastDigitsPhone(value: string): string {
  return (value || "").replace(/\D/g, "").slice(-9);
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * إرسال فاتورة الطلب إلى البريد.
 * التحقق: صاحب الجلسة (صاحب الطلب) أو مطابقة رقم الجوال مع رقم الطلب.
 * لا يُرسل أي بريد إلا بعد التحقق؛ ولا يُخترع «نجاح» إن كان البريد غير مُعدّ.
 */
export const POST = route(async (request: Request) => {
  const limit = rateLimit(`invoice:${clientIp(request)}`, 10, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const number = asString(body.number, 30).toUpperCase();
  const phone = asString(body.phone, 30);
  const email = asString(body.email, 200).toLowerCase();

  if (!number) throw badRequest("رقم الطلب مطلوب", "validation");

  const db = await getDriver();
  const order = await db.getOrderByNumber(number);
  if (!order) throw notFound("لم يتم العثور على الطلب");

  const session = await getSession();
  const isOwner = Boolean(session && order.uid && session.uid === order.uid);
  const phoneOk =
    phone.replace(/\D/g, "").length >= 8 && lastDigitsPhone(order.customer.phone) === lastDigitsPhone(phone);
  if (!isOwner && !phoneOk) throw notFound("لم يتم العثور على الطلب");

  const to = email || (order.customer.email || "").trim().toLowerCase();
  if (!to) throw badRequest("لا يوجد بريد مرتبط بالطلب. أدخل بريدك الإلكتروني.", "validation");
  if (!isEmail(to)) throw badRequest("صيغة البريد الإلكتروني غير صحيحة", "validation");

  const settings = await db.getSettings();
  const result = await sendMail({
    to,
    subject: `فاتورة طلبك ${order.number} — ${settings.storeName}`,
    html: await buildInvoiceHtml(order, settings),
    text: buildInvoiceText(order, settings),
  });

  return json({ sent: result.sent, reason: result.reason, to });
});
