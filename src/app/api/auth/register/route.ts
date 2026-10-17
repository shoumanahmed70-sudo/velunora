import { register } from "@/lib/server/auth-service";
import { setSessionCookie } from "@/lib/server/session";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { isValidPassword } from "@/lib/server/credentials";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  name?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export const POST = route(async (request: Request) => {
  const limit = rateLimit(`register:${clientIp(request)}`, 8, 30 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const name = (body.name || "").trim().slice(0, 80);
  const email = (body.email || "").trim().slice(0, 160);
  const password = body.password || "";
  const phone = (body.phone || "").trim().slice(0, 25);

  if (name.length < 2) throw badRequest("الاسم مطلوب", "validation");
  if (!isValidPassword(password)) throw badRequest("كلمة المرور يجب أن تكون 6 أحرف على الأقل", "weak_password");

  const result = await register({ name, email, password, phone });
  await setSessionCookie(result.uid);

  return json({ ok: true, devVerifyLink: result.devLink ?? null });
});
