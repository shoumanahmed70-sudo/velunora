import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { notFound } from "@/lib/server/errors";
import { parseProductInput } from "@/lib/server/product-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  await requireAdminApi("products");
  const { id } = await context.params;
  const db = await getDriver();
  const product = await db.getProduct(id);
  if (!product) throw notFound("المنتج غير موجود");
  return json({ product });
});

/** تعديل كامل للمنتج، أو تعديل جزئي سريع (الحقول المنطقية فقط) */
export const PUT = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("products");
  const { id } = await context.params;
  const body = (await readJson(request, 256 * 1024)) as Record<string, unknown>;
  const db = await getDriver();

  const existing = await db.getProduct(id);
  if (!existing) throw notFound("المنتج غير موجود");

  const quickKeys = ["active", "featured", "isNew", "onSale", "order"];
  const isQuickToggle = Object.keys(body).every((key) => quickKeys.includes(key));

  let product;
  if (isQuickToggle) {
    const patch: Record<string, unknown> = {};
    for (const key of quickKeys) if (key in body) patch[key] = key === "order" ? Number(body[key]) || 0 : body[key] === true;
    product = await db.updateProduct(id, patch);
    await logAdminAction(admin, "product.quick_update", id, patch);
  } else {
    const merged = parseProductInput({ ...existing, ...body });
    product = await db.updateProduct(id, merged);
    await logAdminAction(admin, "product.update", id, { name: product.name, price: product.price });
  }

  return json({ product });
});

export const DELETE = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("products");
  const { id } = await context.params;
  const db = await getDriver();
  const existing = await db.getProduct(id);
  if (!existing) throw notFound("المنتج غير موجود");
  await db.deleteProduct(id);
  await logAdminAction(admin, "product.delete", id, { name: existing.name });
  return json({ ok: true });
});
