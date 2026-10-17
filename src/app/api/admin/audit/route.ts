import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { asNumber, json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سجل العمليات الإدارية (أحدث 200 افتراضيًا). */
export const GET = route(async (request: Request) => {
  await requireAdminApi("audit");
  const limit = Math.min(Math.max(asNumber(new URL(request.url).searchParams.get("limit"), 200), 1), 500);
  const db = await getDriver();
  return json({ items: await db.listAudit(limit) });
});
