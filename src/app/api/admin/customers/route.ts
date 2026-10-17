import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { asNumber, asString, json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** قائمة العملاء المسجّلين مع عدد طلبات كل عميل. */
export const GET = route(async (request: Request) => {
  await requireAdminApi("customers");
  const url = new URL(request.url);
  const db = await getDriver();
  const result = await db.listCustomers({
    q: asString(url.searchParams.get("q"), 80) || undefined,
    page: asNumber(url.searchParams.get("page"), 1),
    pageSize: asNumber(url.searchParams.get("pageSize"), 20),
  });
  return json({
    items: result.items,
    total: result.total,
    page: asNumber(url.searchParams.get("page"), 1),
    pageSize: asNumber(url.searchParams.get("pageSize"), 20),
  });
});
