import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest } from "@/lib/server/errors";
import { parseCategoryInput } from "@/lib/server/settings-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi("products");
  const db = await getDriver();
  return json({ items: await db.listCategories() });
});

export const POST = route(async (request: Request) => {
  const admin = await requireAdminApi("products");
  const body = await readJson(request);
  let category;
  try {
    category = parseCategoryInput(body);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "بيانات غير صحيحة", "validation");
  }
  const db = await getDriver();
  const saved = await db.saveCategory(category);
  await logAdminAction(admin, "category.create", saved.id, { name: saved.name });
  return json({ category: saved }, 201);
});
