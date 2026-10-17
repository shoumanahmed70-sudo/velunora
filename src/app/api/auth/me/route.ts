import { getDriver } from "@/lib/store";
import { getSessionUser } from "@/lib/server/guard";
import { json, route } from "@/lib/server/http";
import { syncFirebaseEmailVerified } from "@/lib/server/auth-service";
import type { MeResponse } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** المستخدم الحالي + صفته الإدارية (الصلاحيات من الخادم لا من المتصفح). */
export const GET = route(async () => {
  const user = await getSessionUser();
  if (!user) return json({ user: null, admin: null } satisfies MeResponse);

  // مزامنة حالة تأكيد البريد في وضع Firebase (تُحدّث مرة واحدة عند التأكيد)
  await syncFirebaseEmailVerified(user.uid);

  const db = await getDriver();
  const profile = await db.getCustomer(user.uid);

  return json({
    user: profile
      ? {
          uid: profile.uid,
          email: profile.email,
          name: profile.name,
          emailVerified: profile.emailVerified,
          disabled: profile.disabled,
          phone: profile.phone,
          city: profile.city,
          address: profile.address,
        }
      : {
          uid: user.uid,
          email: user.admin?.email || "",
          name: user.admin?.name || "مدير",
          emailVerified: true,
          disabled: false,
        },
    admin: user.admin
      ? {
          uid: user.admin.uid,
          email: user.admin.email,
          name: user.admin.name,
          role: user.admin.role,
          permissions: user.admin.permissions,
        }
      : null,
  } satisfies MeResponse);
});
