import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi("pages");
  const db = await getDriver();
  return json({ items: await db.listPages() });
});
