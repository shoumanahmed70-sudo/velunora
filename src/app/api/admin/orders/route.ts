import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { asNumber, asString, json, route } from "@/lib/server/http";
import { buildOrderMessage, buildWaUrl } from "@/lib/server/whatsapp";
import type { OrderStatus } from "@/lib/types";
import { ORDER_STATUSES } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** قائمة الطلبات مع فلترة بالحالة وبحث نصي + رابط واتساب جاهز لكل طلب. */
export const GET = route(async (request: Request) => {
  await requireAdminApi("orders");
  const url = new URL(request.url);
  const statusRaw = asString(url.searchParams.get("status"), 20);
  const status: OrderStatus | "all" =
    statusRaw && (ORDER_STATUSES as readonly string[]).includes(statusRaw) ? (statusRaw as OrderStatus) : "all";

  const db = await getDriver();
  const [result, settings, priv] = await Promise.all([
    db.listOrders({
      status,
      q: asString(url.searchParams.get("q"), 80) || undefined,
      page: asNumber(url.searchParams.get("page"), 1),
      pageSize: asNumber(url.searchParams.get("pageSize"), 20),
    }),
    db.getSettings(),
    db.getPrivateSettings(),
  ]);

  const items = result.items.map((order) => ({
    ...order,
    waUrl: buildWaUrl(priv.whatsappNumber, buildOrderMessage(order, settings)),
  }));

  return json({ items, total: result.total, page: asNumber(url.searchParams.get("page"), 1), pageSize: asNumber(url.searchParams.get("pageSize"), 20) });
});
