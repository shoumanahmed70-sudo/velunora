import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { parseHomeInput } from "@/lib/server/settings-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi("home");
  const db = await getDriver();
  return json({ home: await db.getHome() });
});

export const PUT = route(async (request: Request) => {
  const admin = await requireAdminApi("home");
  const body = await readJson(request, 256 * 1024);
  const home = parseHomeInput(body);
  const db = await getDriver();
  await db.saveHome(home);
  await logAdminAction(admin, "home.update", "settings/home", {
    sections: home.sections.length,
    banners: home.banners.length,
  });
  return json({ home });
});
