import { changePassword } from "@/lib/server/auth-service";
import { getAdminDoc, requireUserApi } from "@/lib/server/guard";
import { setSessionCookie } from "@/lib/server/session";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  currentPassword?: string;
  newPassword?: string;
}

/**
 * تغيير كلمة مرور الحساب الحالي (عميل عادي أو مدير).
 * لا يُقبل أي معرّف حساب من الطلب — الحساب يُقرأ من الجلسة فقط.
 */
export const POST = route(async (request: Request) => {
  const limit = rateLimit(`password:${clientIp(request)}`, 10, 15 * 60);
  if (!limit.ok) throw tooMany();

  const { uid } = await requireUserApi();
  const body = await readJson<Body>(request, 8 * 1024);

  // كلمات المرور لا تُشذّب: قد تحتوي مسافات مقصودة
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  if (!currentPassword) throw badRequest("أدخل كلمة المرور الحالية", "validation");
  if (newPassword.length > 128) throw badRequest("كلمة المرور طويلة جدًا", "validation");

  await changePassword(uid, currentPassword, newPassword);

  // نُبطل كل الجلسات القديمة (كل الأجهزة)، ثم نُعيد إصدار جلسة هذا الجهاز
  // بالنسخة الجديدة حتى لا يُطرد المستخدم الحالي بعد التغيير.
  await setSessionCookie(uid);

  const admin = await getAdminDoc(uid);
  if (admin) await logAdminAction(admin, "admin.password_change", uid, "");

  return json({ ok: true });
});
