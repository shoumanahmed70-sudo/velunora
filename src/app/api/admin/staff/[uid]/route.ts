import { getDriver } from "@/lib/store";
import { invalidateAdminCache, requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { asString, json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden, notFound } from "@/lib/server/errors";
import { isValidEmail, normalizeEmail } from "@/lib/server/credentials";
import type { AdminDoc, AdminPermission, AdminRole } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALL_PERMISSIONS: AdminPermission[] = [
  "products",
  "orders",
  "customers",
  "settings",
  "home",
  "pages",
  "audit",
];

function sanitizePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [];
  const set = new Set<AdminPermission>();
  for (const raw of value) {
    const p = String(raw) as AdminPermission;
    if (ALL_PERMISSIONS.includes(p)) set.add(p);
  }
  return [...set];
}

function sanitizeRole(value: unknown): AdminRole {
  return value === "owner" ? "owner" : "staff";
}

async function loadTarget(uid: string): Promise<AdminDoc> {
  const db = await getDriver();
  const doc = await db.getAdminByUid(uid);
  if (!doc) throw notFound("حساب المدير غير موجود");
  return doc;
}

/** يمنع إزالة آخر مالك نشط في النظام. */
async function guardLastOwner(target: AdminDoc, next: { role?: AdminRole; active?: boolean }): Promise<void> {
  const willRemainOwner = (next.role ?? target.role) === "owner" && (next.active ?? target.active) !== false;
  if (willRemainOwner) return;
  if (target.role !== "owner") return;
  const db = await getDriver();
  const admins = await db.listAdmins();
  const activeOwners = admins.filter((a) => a.role === "owner" && a.active && a.uid !== target.uid).length;
  if (activeOwners === 0) {
    throw badRequest("لا يمكن إزالة صلاحية أو تعطيل آخر مالك في النظام", "validation");
  }
}

interface UpdateBody {
  email?: string;
  name?: string;
  role?: AdminRole;
  permissions?: unknown;
  active?: boolean;
}

export const PUT = route(async (request: Request, context: { params: Promise<{ uid: string }> }) => {
  const admin = await requireAdminApi();
  if (admin.role !== "owner") throw forbidden("هذه الصفحة متاحة للمالك فقط");

  const { uid } = await context.params;
  const target = await loadTarget(uid);
  const body = await readJson<UpdateBody>(request);

  const role = body.role === undefined ? target.role : sanitizeRole(body.role);
  const active = body.active === undefined ? target.active : body.active !== false;
  const permissions = role === "owner" ? [] : body.permissions === undefined ? target.permissions : sanitizePermissions(body.permissions);
  const email = body.email === undefined ? target.email : normalizeEmail(asString(body.email, 160));
  const name = body.name === undefined ? target.name : asString(body.name, 120);

  if (!isValidEmail(email)) throw badRequest("البريد الإلكتروني غير صحيح", "validation");

  // لا يمكن لمالك إلغاء وصوله بنفسه من الواجهة (حماية من إغلاق النظام بالخطأ)
  if (uid === admin.uid && !active) {
    throw badRequest("لا يمكنك تعطيل حسابك الخاص", "validation");
  }

  await guardLastOwner(target, { role, active });

  const next: AdminDoc = { ...target, email, name: name || target.name, role, permissions, active };
  const db = await getDriver();
  await db.saveAdmin(next);
  invalidateAdminCache(uid);
  await logAdminAction(admin, "staff.update", uid, { email, role, permissions, active });

  return json({ admin: next });
});

export const DELETE = route(async (_request: Request, context: { params: Promise<{ uid: string }> }) => {
  const admin = await requireAdminApi();
  if (admin.role !== "owner") throw forbidden("هذه الصفحة متاحة للمالك فقط");

  const { uid } = await context.params;
  const target = await loadTarget(uid);

  if (uid === admin.uid) throw badRequest("لا يمكنك حذف حسابك الخاص", "validation");
  await guardLastOwner(target, { role: "staff", active: false });

  const db = await getDriver();
  await db.deleteAdmin(uid);
  invalidateAdminCache(uid);
  await logAdminAction(admin, "staff.delete", uid, { email: target.email, role: target.role });

  return json({ ok: true });
});
