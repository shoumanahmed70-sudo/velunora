import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** طلبات العميل الحالي فقط — لا يمكن الوصول لطلبات عميل آخر. */
export const GET = route(async () => {
  const { uid } = await requireUserApi();
  const db = await getDriver();
  return json({ orders: await db.listCustomerOrders(uid) });
});
