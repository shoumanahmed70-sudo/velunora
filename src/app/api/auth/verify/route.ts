import { verifyEmail } from "@/lib/server/auth-service";
import { json, readJson, route } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  token?: string;
}

export const POST = route(async (request: Request) => {
  const body = await readJson<Body>(request);
  await verifyEmail((body.token || "").trim());
  return json({ ok: true });
});
