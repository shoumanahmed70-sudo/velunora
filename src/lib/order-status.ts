import type { OrderStatus } from "@/lib/types";

/** تسميات وألوان حالات الطلب (لوحة الإدارة عربية). */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "جديد",
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  shipped: "خرج للتوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-purple-100 text-purple-800 border-purple-200",
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  processing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  shipped: "bg-cyan-100 text-cyan-800 border-cyan-200",
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

/** الحالات المسموح للعميل أن يقيّم بعدها (شراء موثّق) */
export const REVIEWABLE_STATUSES: OrderStatus[] = [
  "confirmed",
  "processing",
  "shipped",
  "completed",
];
