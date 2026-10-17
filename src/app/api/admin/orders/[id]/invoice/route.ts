import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { sendMail } from "@/lib/server/mailer";
import { buildInvoiceHtml, buildInvoiceText } from "@/lib/server/invoice";
import { asString, json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** إرسال فاتورة الطلب إلى بريد العميل (أو بريد يحدّده المدير). */
export const POST = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("orders");
  const { id } = await context.params;
  const body = await readJson<Body>(request);

  const db = await getDriver();
  const order = await db.getOrder(id);
  if (!order) throw notFound("الطلب غير موجود");

  const to = asString(body.email, 200).toLowerCase() || (order.customer.email || "").trim().toLowerCase();
  if (!to) throw badRequest("لا يوجد بريد للعميل — أدخل بريدًا للإرسال", "validation");
  if (!isEmail(to)) throw badRequest("صيغة البريد غير صحيحة", "validation");

  const settings = await db.getSettings();
  const result = await sendMail({
    to,
    subject: `فاتورة طلبك ${order.number} — ${settings.storeName}`,
    html: await buildInvoiceHtml(order, settings),
    text: buildInvoiceText(order, settings),
  });

  await logAdminAction(admin, "order.invoice", id, { number: order.number, to, sent: result.sent });

  return json({ sent: result.sent, reason: result.reason, to });
});
