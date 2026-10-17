import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden } from "@/lib/server/errors";
import { parsePrivateSettingsInput } from "@/lib/server/settings-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** رقم واتساب المدير وإعدادات البريد — للمالك فقط، ولا تُعرض في أي واجهة عامة. */
export const GET = route(async () => {
  const admin = await requireAdminApi("settings");
  if (admin.role !== "owner") throw forbidden("هذه الإعدادات متاحة للمالك فقط");
  const db = await getDriver();
  return json({ private: await db.getPrivateSettings() });
});

export const PUT = route(async (request: Request) => {
  const admin = await requireAdminApi("settings");
  if (admin.role !== "owner") throw forbidden("هذه الإعدادات متاحة للمالك فقط");

  const body = await readJson(request, 64 * 1024);
  let priv;
  try {
    priv = parsePrivateSettingsInput(body);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "بيانات غير صحيحة", "validation");
  }

  const db = await getDriver();
  await db.savePrivateSettings(priv);
  await logAdminAction(admin, "settings.private_update", "store", {
    whatsappConfigured: Boolean(priv.whatsappNumber),
    smtpEnabled: priv.smtp.enabled,
  });

  return json({ private: priv });
});
