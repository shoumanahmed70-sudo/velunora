import "server-only";

import crypto from "node:crypto";
import { getDriver } from "@/lib/store";
import type { AdminDoc, AuditEntry } from "@/lib/types";

/** تسجيل العمليات الإدارية المهمة (إضافة/تعديل/حذف/تغيير حالة/صلاحيات). */
export async function logAdminAction(
  admin: Pick<AdminDoc, "uid" | "email">,
  action: string,
  target: string,
  meta: unknown = ""
): Promise<void> {
  try {
    const entry: AuditEntry = {
      id: `aud_${crypto.randomUUID()}`,
      actorUid: admin.uid,
      actorEmail: admin.email,
      action,
      target,
      meta: typeof meta === "string" ? meta.slice(0, 500) : JSON.stringify(meta ?? "").slice(0, 500),
      createdAt: Date.now(),
    };
    const db = await getDriver();
    await db.logAudit(entry);
  } catch (error) {
    // فشل التدقيق لا يجب أن يُسقط العملية الأصلية، لكنه يُسجّل في سجل الخادم
    console.error("[velunora] audit log failed:", error instanceof Error ? error.message : error);
  }
}
