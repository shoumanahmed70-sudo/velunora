import { resetPassword } from "@/lib/server/auth-service";
import { json, readJson, route } from "@/lib/server/http";
import { tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  token?: string;
  password?: string;
}

export const POST = route(async (request: Request) => {
  const limit = rateLimit(`reset:${clientIp(request)}`, 10, 30 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request);
  await resetPassword((body.token || "").trim(), body.password || "");
  return json({ ok: true });
});
