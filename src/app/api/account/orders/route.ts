import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { toPublicOrders } from "@/lib/server/public-order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** طلبات العميل الحالي فقط — لا يمكن الوصول لطلبات عميل آخر، وبلا حقول إدارية. */
export const GET = route(async () => {
  const { uid } = await requireUserApi();
  const db = await getDriver();
  return json({ orders: toPublicOrders(await db.listCustomerOrders(uid)) });
});
