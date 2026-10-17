import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تفاصيل طلب واحد للعميل — بشرط أن يكون الطلب مملوكًا له. */
export const GET = route(async (_request: Request, context: { params: Promise<{ number: string }> }) => {
  const { uid } = await requireUserApi();
  const { number } = await context.params;
  const db = await getDriver();
  const order = await db.getOrderByNumber(decodeURIComponent(number).trim().toUpperCase());

  if (!order || order.uid !== uid) throw notFound("الطلب غير موجود");
  return json({ order });
});
