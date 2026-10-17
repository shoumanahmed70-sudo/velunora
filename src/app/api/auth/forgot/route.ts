import { sendReset } from "@/lib/server/auth-service";
import { json, readJson, route } from "@/lib/server/http";
import { tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  email?: string;
}

/**
 * طلب إعادة تعيين كلمة المرور.
 * لا نكشف إن كان البريد مسجّلًا أم لا (منع تعداد الحسابات).
 * رابط التطوير يظهر فقط عند تعطيل SMTP و NODE_ENV != production مع ALLOW_DEV_LINKS.
 */
export const POST = route(async (request: Request) => {
  const limit = rateLimit(`forgot:${clientIp(request)}`, 6, 30 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  const result = await sendReset((body.email || "").trim().slice(0, 160));

  return json({
    ok: true,
    devResetLink: result.devLink ?? null,
    mailDisabled: result.mailDisabled ?? false,
  });
});
