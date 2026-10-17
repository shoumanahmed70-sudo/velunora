import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { parseSettingsInput } from "@/lib/server/settings-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async () => {
  await requireAdminApi("settings");
  const db = await getDriver();
  return json({ settings: await db.getSettings() });
});

export const PUT = route(async (request: Request) => {
  const admin = await requireAdminApi("settings");
  const body = await readJson(request, 128 * 1024);
  const settings = parseSettingsInput(body);
  const db = await getDriver();
  await db.saveSettings(settings);
  await logAdminAction(admin, "settings.update", "store", {
    storeName: settings.storeName,
    ordersEnabled: settings.ordersEnabled,
  });
  return json({ settings });
});
