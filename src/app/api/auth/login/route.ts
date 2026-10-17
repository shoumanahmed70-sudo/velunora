import { login } from "@/lib/server/auth-service";
import { setSessionCookie } from "@/lib/server/session";
import { getDriver } from "@/lib/store";
import { json, readJson, route } from "@/lib/server/http";
import { tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { invalidateAdminCache } from "@/lib/server/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
  password?: string;
}

export const POST = route(async (request: Request) => {
  // حد صارم لمحاولات الدخول (حماية من التخمين)
  const limit = rateLimit(`login:${clientIp(request)}`, 10, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const uid = await login((body.email || "").trim().slice(0, 160), body.password || "");
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
