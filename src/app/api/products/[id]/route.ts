import { getProduct } from "@/lib/server/catalog";
import { json, route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** منتج واحد بالمعرّف أو الـ slug (المنتجات المخفية لا تُعرض) */
export const GET = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const product = await getProduct(decodeURIComponent(id));
  if (!product) throw notFound("المنتج غير موجود");
  return json({ product });
});
