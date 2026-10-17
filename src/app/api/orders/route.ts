import { getDriver } from "@/lib/store";
import { getSession } from "@/lib/server/session";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden, tooMany } from "@/lib/server/errors";
import { clientIp, rateLimit } from "@/lib/server/ratelimit";
import { buildOrderMessage, buildWaUrl } from "@/lib/server/whatsapp";
import { isValidPhone } from "@/lib/server/credentials";
import type { CartLine } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  items?: CartLine[];
  customer?: {
    name?: string;
    phone?: string;
    city?: string;
    address?: string;
    notes?: string;
    email?: string;
  };
  idempotencyKey?: string;
}

/**
 * إنشاء طلب جديد:
 * - الأسعار والمجاميع تُحسب على الخادم من قاعدة البيانات (لا يُعتمد أي سعر من المتصفح).
 * - الحفظ داخل معاملة مع منع التكرار عبر idempotencyKey، ثم يُعاد رابط واتساب المدير.
 * - فتح واتساب لا يعني الإرسال؛ الإرسال يتم يدويًا من العميل داخل التطبيق.
 */
export const POST = route(async (request: Request) => {
  const limit = rateLimit(`order:${clientIp(request)}`, 12, 10 * 60);
  if (!limit.ok) throw tooMany();

  const body = await readJson<Body>(request, 96 * 1024);

  const key = (body.idempotencyKey || "").trim();
  if (!/^[a-zA-Z0-9_-]{8,80}$/.test(key)) {
    throw badRequest("مفتاح الطلب غير صحيح", "validation");
  }

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (rawItems.length === 0) throw badRequest("السلة فارغة", "validation");

  const items = rawItems.map((line) => {
    const qty = Math.floor(Number(line?.qty));
    if (!line?.productId || !Number.isInteger(qty) || qty < 1 || qty > 99) {
      throw badRequest("بيانات السلة غير صحيحة", "validation");
    }
    const options: Record<string, string> = {};
    for (const [k, v] of Object.entries(line.options || {})) {
      if (typeof k === "string" && typeof v === "string" && k.length <= 60 && v.length <= 60) options[k] = v;
    }
    return {
      productId: String(line.productId).slice(0, 80),
      variantId: line.variantId ? String(line.variantId).slice(0, 80) : null,
      options,
      qty,
    };
  });

  const db = await getDriver();
  const session = await getSession();
  let uid: string | null = null;
  let accountEmail: string | null = null;

  if (session) {
    const profile = await db.getCustomer(session.uid);
    if (profile?.disabled) throw forbidden("هذا الحساب معطّل، تواصل مع المتجر", "disabled");
    uid = session.uid;
    accountEmail = profile?.email ?? null;
  }

  const customer = {
    name: (body.customer?.name || "").trim().slice(0, 80),
    phone: (body.customer?.phone || "").trim().slice(0, 25),
    city: (body.customer?.city || "").trim().slice(0, 60),
    address: (body.customer?.address || "").trim().slice(0, 300),
    notes: (body.customer?.notes || "").trim().slice(0, 500),
    email: accountEmail,
  };

  if (customer.name.length < 2) throw badRequest("الاسم مطلوب", "validation");
  if (!isValidPhone(customer.phone)) throw badRequest("رقم الجوال غير صحيح", "validation");
  if (customer.city.length < 2) throw badRequest("المدينة مطلوبة", "validation");
  if (customer.address.length < 5) throw badRequest("العنوان مطلوب بالتفصيل", "validation");

  const { order, duplicate } = await db.createOrder({
    idempotencyKey: key,
    uid,
    customer,
    items,
  });

  // تفريغ سلة العميل المحفوظة على الخادم بعد نجاح الطلب
  // (وإلا عادت المنتجات إلى السلة عند أول تحميل بعد الطلب)
  if (uid) {
    await db.setCart(uid, []).catch(() => undefined);
  }

  const [settings, priv] = await Promise.all([db.getSettings(), db.getPrivateSettings()]);
  const message = buildOrderMessage(order, settings);
  const waUrl = buildWaUrl(priv.whatsappNumber, message);

  return json({ order, waUrl, waMessage: message, duplicate });
});
