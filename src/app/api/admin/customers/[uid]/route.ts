import { getDriver } from "@/lib/store";
import { requireAdminApi } from "@/lib/server/guard";
import { bumpSessionVersion } from "@/lib/server/auth-service";
import { logAdminAction } from "@/lib/server/audit";
import { json, readJson, route } from "@/lib/server/http";
import { badRequest, notFound } from "@/lib/server/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (_request: Request, context: { params: Promise<{ uid: string }> }) => {
  await requireAdminApi("customers");
  const { uid } = await context.params;
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw notFound("العميل غير موجود");
  const orders = await db.listCustomerOrders(uid);
  return json({ profile, orders });
});

interface Body {
  disabled?: boolean;
}

/**
 * تعطيل/تفعيل حساب عميل.
 * لا يوجد حذف للحسابات أو بياناتها — يُمنع الحذف النهائي إلا بإجراء وصلاحية عليا (موثّق في README).
 */
export const PUT = route(async (request: Request, context: { params: Promise<{ uid: string }> }) => {
  const admin = await requireAdminApi("customers");
  const { uid } = await context.params;
  const body = await readJson<Body>(request);

  if (typeof body.disabled !== "boolean") throw badRequest("قيمة التعطيل مطلوبة", "validation");
  if (uid === admin.uid) throw badRequest("لا يمكنك تعطيل حسابك الخاص", "validation");

  const db = await getDriver();
  const profile = await db.setCustomerDisabled(uid, body.disabled);
  // عند التعطيل نُبطل كل جلسات الحساب فورًا حتى لا يبقى دخوله قائمًا
  if (body.disabled) await bumpSessionVersion(uid);
  await logAdminAction(admin, body.disabled ? "customer.disable" : "customer.enable", uid, {
    email: profile.email,
  });
  return json({ profile });
});
