import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound } from "@/lib/server/errors";
import { buildOrderMessage, buildStatusMessage, buildWaUrl } from "@/lib/server/whatsapp";
import { buildInvoiceText } from "@/lib/server/invoice";
import { STATUS_LABELS } from "@/lib/order-status";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function withWa(orderId: string) {
  const db = await getDriver();
  const order = await db.getOrder(orderId);
  if (!order) throw notFound("الطلب غير موجود");
  const [settings, priv] = await Promise.all([db.getSettings(), db.getPrivateSettings()]);
  const message = buildOrderMessage(order, settings);
  const invoiceMessage = buildInvoiceText(order, settings);
  return {
    order,
    waMessage: message,
    waUrl: buildWaUrl(priv.whatsappNumber, message),
    // فاتورة جاهزة للإرسال يدويًا من رقم المدير إلى جوال العميل
    invoiceMessage,
    invoiceWaUrl: buildWaUrl(order.customer.phone, invoiceMessage),
  };
}

export const GET = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  await requireAdminApi("orders");
  const { id } = await context.params;
  return json(await withWa(id));
});

interface Body {
  status?: string;
  internalNotes?: string;
}

/** تحديث حالة الطلب أو الملاحظات الداخلية — كل تغيير حالة يُسجَّل في سجل التدقيق. */
export const PUT = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("orders");
  const { id } = await context.params;
  const body = await readJson<Body>(request);

  const patch: { status?: OrderStatus; internalNotes?: string } = {};

  if (body.status !== undefined) {
    if (!(ORDER_STATUSES as readonly string[]).includes(String(body.status))) {
      throw badRequest("حالة الطلب غير صحيحة", "validation");
    }
    patch.status = body.status as OrderStatus;
  }
  if (typeof body.internalNotes === "string") patch.internalNotes = body.internalNotes;

  if (Object.keys(patch).length === 0) throw badRequest("لا يوجد تغيير للحفظ", "validation");

  const db = await getDriver();
  const updated = await db.updateOrder(id, patch);

  await logAdminAction(admin, patch.status ? "order.status" : "order.notes", id, {
    number: updated.number,
    status: patch.status,
    label: patch.status ? STATUS_LABELS[patch.status] : undefined,
  });

  const [settings, priv] = await Promise.all([db.getSettings(), db.getPrivateSettings()]);
  const message = patch.status
    ? buildStatusMessage(updated, settings, STATUS_LABELS[patch.status])
    : buildOrderMessage(updated, settings);
  const invoiceMessage = buildInvoiceText(updated, settings);

  return json({
    order: updated,
    waMessage: message,
    waUrl: buildWaUrl(priv.whatsappNumber, message),
    invoiceMessage,
    invoiceWaUrl: buildWaUrl(updated.customer.phone, invoiceMessage),
  });
});
