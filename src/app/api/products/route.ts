import { listProducts } from "@/lib/server/catalog";
import { asNumber, asString, json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** قائمة منتجات عامة مع بحث وفلترة وترتيب وترقيم مؤشر */
export const GET = route(async (request: Request) => {
  const url = new URL(request.url);
  const sortRaw = asString(url.searchParams.get("sort"), 20);
  const sort =
    sortRaw === "price_asc" || sortRaw === "price_desc" || sortRaw === "featured" ? sortRaw : "newest";
  const tagRaw = asString(url.searchParams.get("tag"), 20);

  const result = await listProducts({
    category: asString(url.searchParams.get("category"), 60) || undefined,
    tag: tagRaw === "new" || tagRaw === "sale" ? tagRaw : undefined,
    featured: url.searchParams.get("featured") === "1",
    q: asString(url.searchParams.get("q"), 80) || undefined,
    sort,
    limit: asNumber(url.searchParams.get("limit"), 24),
    cursor: asString(url.searchParams.get("cursor"), 20) || undefined,
  });

  return json(result);
});
