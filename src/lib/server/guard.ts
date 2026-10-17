import "server-only";

import type { AdminDoc, AdminPermission } from "@/lib/types";
import { getDriver } from "@/lib/store";
import { getSession } from "@/lib/server/session";
import { forbidden, unauthorized } from "@/lib/server/errors";

/** ذاكرة مؤقتة قصيرة لسجلات المدراء لتخفيف القراءات (٣٠ ثانية). */
const adminCache = new Map<string, { at: number; doc: AdminDoc | null }>();
const CACHE_MS = 30_000;

export async function getAdminDoc(uid: string): Promise<AdminDoc | null> {
  const hit = adminCache.get(uid);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.doc;
  const db = await getDriver();
  const doc = await db.getAdminByUid(uid);
  adminCache.set(uid, { at: Date.now(), doc });
  return doc;
}

export function invalidateAdminCache(uid?: string) {
  if (uid) adminCache.delete(uid);
  else adminCache.clear();
}

export interface SessionUser {
  uid: string;
  isAdmin: boolean;
  admin: AdminDoc | null;
}

/** المستخدم الحالي من الكوكي (+ كونه مديرًا نشطًا) */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  const admin = await getAdminDoc(session.uid);
  const activeAdmin = admin && admin.active ? admin : null;
  return { uid: session.uid, isAdmin: Boolean(activeAdmin), admin: activeAdmin };
}

function hasPermission(admin: AdminDoc, permission?: AdminPermission): boolean {
  if (!permission) return true;
  if (admin.role === "owner") return true;
  return admin.permissions.includes(permission);
}

/** للمسارات البرمجية: يرمي 401/403 بدل التوجيه */
export async function requireAdminApi(permission?: AdminPermission): Promise<AdminDoc> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (!user.admin) throw forbidden("هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة");
  if (!hasPermission(user.admin, permission)) throw forbidden("ليست لديك صلاحية لهذه الصفحة");
  return user.admin;
}

/** للصفحات (Server Components): يوجّه بدل رمي الأخطاء */
export async function requireAdminPage(permission?: AdminPermission): Promise<AdminDoc> {
  const { redirect } = await import("next/navigation");
  const user = await getSessionUser();
  if (!user || !user.admin) {
    redirect("/admin/login");
    throw new Error("unreachable: redirect");
  }
  if (!hasPermission(user.admin, permission)) {
    redirect("/admin?denied=1");
    throw new Error("unreachable: redirect");
  }
  return user.admin;
}

/** للمسارات البرمجية الخاصة بالعميل: يتأكد من الجلسة وأن الحساب غير معطّل. */
export async function requireUserApi(): Promise<{ uid: string }> {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  const db = await getDriver();
  const profile = await db.getCustomer(user.uid);
  if (profile?.disabled) {
    throw forbidden("هذا الحساب معطّل، تواصل مع المتجر", "disabled");
  }
  return { uid: user.uid };
}
