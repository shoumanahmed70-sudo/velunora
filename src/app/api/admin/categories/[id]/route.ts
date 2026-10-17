import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { parseCategoryInput } from "@/lib/server/settings-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = route(async (request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("products");
  const { id } = await context.params;
  const body = await readJson(request);
  let category;
  try {
    category = parseCategoryInput(body, id);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "بيانات غير صحيحة", "validation");
  }
  const db = await getDriver();
  const saved = await db.saveCategory(category);
  await logAdminAction(admin, "category.update", id, { name: saved.name });
  return json({ category: saved });
});

/** حذف قسم — المنتجات المرتبطة لا تُحذف، لكنها تفقد تصنيفها. */
export const DELETE = route(async (_request: Request, context: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdminApi("products");
  const { id } = await context.params;
  const db = await getDriver();
  await db.deleteCategory(id);
  await logAdminAction(admin, "category.delete", id, "");
  return json({ ok: true });
});
