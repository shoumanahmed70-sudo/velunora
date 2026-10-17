import { clearSessionCookie } from "@/lib/server/session";
import { json, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = route(async () => {
  await clearSessionCookie();
  return json({ ok: true });
});
