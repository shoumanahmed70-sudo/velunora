import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { asString, json, readJson, route } from "@/lib/server/http";
import { parseProductInput } from "@/lib/server/product-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** كل المنتجات (بما فيها المخفية) مع بحث اختياري */
export const GET = route(async (request: Request) => {
  await requireAdminApi("products");
  const q = asString(new URL(request.url).searchParams.get("q"), 80);
  const db = await getDriver();
  const { items } = await db.listProducts({ includeInactive: true, limit: 60, q: q || undefined });

  // ترتيب إداري: حسب order ثم الأحدث
  items.sort((a, b) => a.order - b.order || b.createdAt - a.createdAt);
  return json({ items });
});

export const POST = route(async (request: Request) => {
  const admin = await requireAdminApi("products");
  const body = await readJson(request, 256 * 1024);
  const input = parseProductInput(body);
  const db = await getDriver();
  const product = await db.createProduct(input);
  await logAdminAction(admin, "product.create", product.id, { name: product.name, price: product.price });
  return json({ product }, 201);
});
