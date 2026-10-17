import { getDriver } from "@/lib/store";
import { invalidateAdminCache, requireAdminApi } from "@/lib/server/guard";
import { logAdminAction } from "@/lib/server/audit";
import { asString, json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden } from "@/lib/server/errors";
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

/** يتحقق أن الصلاحيات المُرسلة من الواجهة مسموحة فقط (لا يمكن منح صلاحية غير معروفة) */
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

/** owner فقط: عرض/إضافة حسابات المدراء. */
export const GET = route(async () => {
  const admin = await requireAdminApi();
  if (admin.role !== "owner") throw forbidden("هذه الصفحة متاحة للمالك فقط");
  const db = await getDriver();
  const items = await db.listAdmins();
  items.sort((a, b) => a.createdAt - b.createdAt);
  return json({ items });
});

interface CreateBody {
  uid?: string;
  email?: string;
  name?: string;
  role?: AdminRole;
  permissions?: unknown;
  active?: boolean;
}

export const POST = route(async (request: Request) => {
  const admin = await requireAdminApi();
  if (admin.role !== "owner") throw forbidden("هذه الصفحة متاحة للمالك فقط");

  const body = await readJson<CreateBody>(request);
  const uid = asString(body.uid, 120);
  const email = normalizeEmail(asString(body.email, 160));
  const name = asString(body.name, 120);
  const role = sanitizeRole(body.role);
  const permissions = role === "owner" ? [] : sanitizePermissions(body.permissions);
  const active = body.active !== false;

  if (!uid) throw badRequest("معرّف الحساب (UID) مطلوب", "validation");
  if (!isValidEmail(email)) throw badRequest("البريد الإلكتروني غير صحيح", "validation");

  const db = await getDriver();
  const existing = await db.getAdminByUid(uid);
  if (existing) throw badRequest("هذا الحساب مضاف بالفعل كمدير", "duplicate");

  const now = Date.now();
  const doc: AdminDoc = {
    uid,
    email,
    name: name || email.split("@")[0],
    role,
    permissions,
    active,
    createdAt: now,
    lastLoginAt: null,
  };
  await db.saveAdmin(doc);
  invalidateAdminCache(uid);
  await logAdminAction(admin, "staff.create", uid, { email, role, permissions, active });

  return json({ admin: doc });
});
