import { login } from "@/lib/server/auth-service";
import { setSessionCookie } from "@/lib/server/session";
import { getDriver } from "@/lib/store";
import { json, readJson, route } from "@/lib/server/http";
import { tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { invalidateAdminCache } from "@/lib/server/guard";
import { normalizeEmail } from "@/lib/server/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
  password?: string;
}

export const POST = route(async (request: Request) => {
  // حد صارم لمحاولات الدخول من نفس العنوان (حماية من التخمين)
  const limit = rateLimit(`login:${clientIp(request)}`, 10, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const email = (body.email || "").trim().slice(0, 160);

  // حد إضافي لكل بريد: يمنع تخمين كلمة مرور حساب واحد من عناوين متعدّدة
  const emailLimit = rateLimit(`login:email:${normalizeEmail(email)}`, 8, 15 * 60);
  if (!emailLimit.ok) throw tooMany();

  const uid = await login(email, body.password || "");
  await setSessionCookie(uid);

  const db = await getDriver();
  const admin = await db.getAdminByUid(uid);
  const activeAdmin = admin && admin.active ? admin : null;

  if (activeAdmin) {
    await db.saveAdmin({ ...activeAdmin, lastLoginAt: Date.now() });
    invalidateAdminCache(uid);
  }

  return json({
    ok: true,
    admin: activeAdmin
      ? {
          uid: activeAdmin.uid,
          email: activeAdmin.email,
          name: activeAdmin.name,
          role: activeAdmin.role,
          permissions: activeAdmin.permissions,
        }
      : null,
  });
});
