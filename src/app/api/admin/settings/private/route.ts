import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { encryptSecret } from "@/lib/server/settings-crypto";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden } from "@/lib/server/errors";
import { parsePrivateSettingsInput } from "@/lib/server/settings-input";
import type { PrivateSettings, PrivateSettingsView } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** يحوّل الإعدادات الخاصة إلى نسخة آمنة للواجهة (بلا كلمة سر SMTP). */
function toView(priv: PrivateSettings): PrivateSettingsView {
  const { pass, ...smtp } = priv.smtp;
  return { whatsappNumber: priv.whatsappNumber, smtp: { ...smtp, hasPassword: Boolean(pass) } };
}

/** رقم واتساب المدير وإعدادات البريد — للمالك فقط، ولا تُعرض في أي واجهة عامة. */
export const GET = route(async () => {
  const admin = await requireAdminApi("settings");
  if (admin.role !== "owner") throw forbidden("هذه الإعدادات متاحة للمالك فقط");
  const db = await getDriver();
  return json({ private: toView(await db.getPrivateSettings()) });
});

export const PUT = route(async (request: Request) => {
  const admin = await requireAdminApi("settings");
  if (admin.role !== "owner") throw forbidden("هذه الإعدادات متاحة للمالك فقط");

  const body = await readJson(request, 64 * 1024);
  let priv: PrivateSettings;
  try {
    priv = parsePrivateSettingsInput(body);
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : "بيانات غير صحيحة", "validation");
  }

  const db = await getDriver();
  const existing = await db.getPrivateSettings();

  // كلمة السر: إن جاء الحقل فارغًا نُبقي القيمة المخزّنة (المشفّرة)،
  // وإن جاءت قيمة جديدة نُشفّرها قبل التخزين.
  const incoming = priv.smtp.pass.trim();
  const storedPass = incoming ? encryptSecret(priv.smtp.pass) : existing.smtp.pass;

  const toSave: PrivateSettings = { ...priv, smtp: { ...priv.smtp, pass: storedPass } };
  await db.savePrivateSettings(toSave);
  await logAdminAction(admin, "settings.private_update", "store", {
    whatsappConfigured: Boolean(toSave.whatsappNumber),
    smtpEnabled: toSave.smtp.enabled,
    smtpPasswordUpdated: Boolean(incoming),
  });

  return json({ private: toView(toSave) });
});
