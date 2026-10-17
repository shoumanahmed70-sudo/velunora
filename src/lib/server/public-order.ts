import "server-only";

import type { Order, PublicOrder } from "@/lib/types";

/**
 * نسخة الطلب الآمنة للعميل.
 *
 * تحذف ملاحظات الإدارة ومفتاح منع التكرار (وأي حقل إداري يُضاف مستقبلًا)،
 * وتُستخدم في كل المسارات العامة ومسارات العميل:
 *   - /api/orders (بعد الإنشاء)
 *   - /api/orders/lookup
 *   - /api/account/orders
 *   - /api/account/orders/[number]
 *
 * لا تُستخدم في /api/admin/* حيث يبقى الطلب كاملًا للمدير.
 */
export function toPublicOrder(order: Order): PublicOrder {
  const { internalNotes: _internalNotes, idempotencyKey: _idempotencyKey, ...rest } = order;
  return rest;
}

/** نسخة مصفوفة — للقوائم. */
export function toPublicOrders(orders: Order[]): PublicOrder[] {
  return orders.map(toPublicOrder);
}
