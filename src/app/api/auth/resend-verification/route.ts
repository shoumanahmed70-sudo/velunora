import { sendVerification } from "@/lib/server/auth-service";
import { getSessionUser } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { unauthorized, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async (request: Request) => {
  const user = await getSessionUser();
  if (!user) throw unauthorized();

  const limit = rateLimit(`verify-send:${clientIp(request)}:${user.uid}`, 4, 30 * 60);
  if (!limit.ok) throw tooMany();

  const result = await sendVerification(user.uid);
  return json({ ok: true, devVerifyLink: result.devLink ?? null });
});
