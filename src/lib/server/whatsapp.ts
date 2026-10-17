import type { Order, StoreSettings } from "@/lib/types";

/** تنظيف رقم واتساب: أرقام فقط، وإزالة الأصفار/الرموز التي تكسر رابط wa.me */
export function normalizeWhatsappNumber(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // 00966 / 0966 → 966
  const trimmed = digits.replace(/^00/, "");
  return trimmed;
}

export function buildWaUrl(number: string, message: string): string {
  const clean = normalizeWhatsappNumber(number);
  if (!clean) return "";
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}

function money(amount: number, settings: StoreSettings): string {
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount || 0);
  return `${value} ${settings.currencySymbol}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * نص ملخص الطلب المرسل إلى رقم المدير.
 * لا يحتوي أي أسرار أو مفاتيح — بيانات الطلب فقط.
 */
export function buildOrderMessage(order: Order, settings: StoreSettings): string {
  const lines: string[] = [];
  lines.push(`*طلب جديد — ${settings.storeName}*`);
  lines.push(`رقم الطلب: ${order.number}`);
  lines.push("");
  lines.push("*المنتجات:*");
  order.items.forEach((item, index) => {
    const variant = item.variantLabel ? ` — ${item.variantLabel}` : "";
    const options = Object.entries(item.options || {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(" / ");
    lines.push(`${index + 1}) ${item.name}${variant}`);
    if (options) lines.push(`   ${options}`);
    lines.push(`   الكمية: ${item.qty} × ${money(item.unitPrice, settings)} = ${money(item.total, settings)}`);
  });
  lines.push("");
  lines.push(`المجموع الفرعي: ${money(order.subtotal, settings)}`);
  if (order.discount > 0) lines.push(`الخصم: ${money(order.discount, settings)}`);
  lines.push(`الشحن: ${order.shipping > 0 ? money(order.shipping, settings) : "مجاني"}`);
  if (order.tax > 0) lines.push(`الضريبة: ${money(order.tax, settings)}`);
  lines.push(`*الإجمالي: ${money(order.total, settings)}*`);
  lines.push("");
  lines.push("*بيانات العميل:*");
  lines.push(`الاسم: ${order.customer.name}`);
  lines.push(`الجوال: ${order.customer.phone}`);
  lines.push(`المدينة: ${order.customer.city}`);
  lines.push(`العنوان: ${order.customer.address}`);
  if (order.customer.notes) lines.push(`ملاحظات: ${order.customer.notes}`);
  lines.push("");
  lines.push(`تاريخ الطلب: ${formatDate(order.createdAt)}`);
  return lines.join("\n");
}

export function buildContactMessage(settings: StoreSettings): string {
  return `مرحبًا ${settings.storeName}، أرغب بالاستفسار عن منتجاتكم.`;
}

/** إشعار داخلي جاهز للمدير عند تغيير حالة الطلب */
export function buildStatusMessage(order: Order, settings: StoreSettings, statusLabel: string): string {
  return [
    `*تحديث حالة طلب — ${settings.storeName}*`,
    `رقم الطلب: ${order.number}`,
    `الحالة الجديدة: ${statusLabel}`,
    `الإجمالي: ${money(order.total, settings)}`,
    `العميل: ${order.customer.name} — ${order.customer.phone}`,
  ].join("\n");
}
