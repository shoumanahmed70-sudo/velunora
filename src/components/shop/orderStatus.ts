import type { OrderStatus } from "@/lib/types";
import type { TKey } from "@/lib/i18n/dict";

/** خلفية/لون شارة حالة الطلب. */
export const STATUS_TONE: Record<OrderStatus, string> = {
  new: "bg-primary/10 text-primary",
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-sky-100 text-sky-800",
  processing: "bg-indigo-100 text-indigo-800",
  shipped: "bg-cyan-100 text-cyan-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-700",
};

export function statusLabelKey(status: OrderStatus): TKey {
  return `status_${status}` as TKey;
}
