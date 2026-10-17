import { sessionFromIdToken } from "@/lib/server/auth-service";
import { setSessionCookie } from "@/lib/server/session";
import { getDriver } from "@/lib/store";
import { invalidateAdminCache } from "@/lib/server/guard";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { GOOGLE_AUTH_ENABLED } from "@/lib/server/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  idToken?: string;
}

/**
 * تبادل رمز Firebase ID (من تسجيل Google) بجلسة كوكي HttpOnly على الخادم.
 * لا تُخزَّن أي رموز Firebase في المتصفح بعد ذلك.
 */
export const POST = route(async (request: Request) => {
  if (!GOOGLE_AUTH_ENABLED) throw badRequest("تسجيل Google غير مُفعّل", "validation");

  const limit = rateLimit(`session:${clientIp(request)}`, 20, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const idToken = (body.idToken || "").trim();
  if (!idToken) throw badRequest("رمز الدخول مطلوب", "validation");

  const uid = await sessionFromIdToken(idToken);
  await setSessionCookie(uid);

  const db = await getDriver();
  const admin = await db.getAdminByUid(uid);
  const activeAdmin = admin && admin.active ? admin : null;
  invalidateAdminCache(uid);

  return json({
    ok: true,
    admin: activeAdmin ? { role: activeAdmin.role, permissions: activeAdmin.permissions } : null,
  });
});
