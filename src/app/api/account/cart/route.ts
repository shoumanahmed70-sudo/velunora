import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { json, readJson, route } from "@/lib/server/http";
import type { CartLine } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** سلة العميل المحفوظة على الخادم (تبقى بعد تغيير الجهاز). */
export const GET = route(async () => {
  const { uid } = await requireUserApi();
  const db = await getDriver();
  return json({ lines: await db.getCart(uid) });
});

interface Body {
  lines?: CartLine[];
}

export const PUT = route(async (request: Request) => {
  const { uid } = await requireUserApi();
  const body = await readJson<Body>(request, 128 * 1024);
  const raw = Array.isArray(body.lines) ? body.lines.slice(0, 60) : [];

  const lines: CartLine[] = [];
  for (const line of raw) {
    const qty = Math.floor(Number(line?.qty));
    if (!line?.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) continue;
    const options: Record<string, string> = {};
    for (const [k, v] of Object.entries(line.options || {})) {
      if (typeof k === "string" && typeof v === "string" && k.length <= 60 && v.length <= 60) options[k] = v;
    }
    lines.push({
      productId: String(line.productId).slice(0, 80),
      variantId: line.variantId ? String(line.variantId).slice(0, 80) : null,
      options,
      qty,
    });
  }

  const db = await getDriver();
  await db.setCart(uid, lines);
  return json({ ok: true });
});
