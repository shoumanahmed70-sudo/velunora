import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { asString, route } from "@/lib/server/http";
import { STATUS_LABELS } from "@/lib/order-status";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value: unknown): string {
  const text = String(value ?? "").replace(/\r?\n/g, " ").replace(/"/g, '""');
  return `"${text}"`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** تصدير الطلبات إلى CSV بترميز UTF-8 مع BOM ليفتح صحيحًا في Excel العربي. */
export const GET = route(async (request: Request) => {
  await requireAdminApi("orders");
  const url = new URL(request.url);
  const statusRaw = asString(url.searchParams.get("status"), 20);
  const status: OrderStatus | "all" =
    statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as OrderStatus) : "all";

  const db = await getDriver();
  const { items } = await db.listOrders({
    status,
    q: asString(url.searchParams.get("q"), 80) || undefined,
    page: 1,
    pageSize: 100,
  });

  const header = [
    "رقم الطلب",
    "التاريخ",
    "الحالة",
    "اسم العميل",
    "الجوال",
    "المدينة",
    "العنوان",
    "المنتجات",
    "المجموع الفرعي",
    "الخصم",
    "الشحن",
    "الضريبة",
    "الإجمالي",
    "العملة",
    "ملاحظات العميل",
    "ملاحظات داخلية",
  ];

  const rows = items.map((order) => [
    order.number,
    formatDate(order.createdAt),
    STATUS_LABELS[order.status],
    order.customer.name,
    order.customer.phone,
    order.customer.city,
    order.customer.address,
    order.items
      .map((i) => `${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} × ${i.qty}`)
      .join(" | "),
    order.subtotal,
    order.discount,
    order.shipping,
    order.tax,
    order.total,
    order.currency,
    order.customer.notes,
    order.internalNotes,
  ]);

  const csv = "\uFEFF" + [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="velunora-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
