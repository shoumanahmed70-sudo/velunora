import { requireAdminPage } from "@/lib/server/guard";
import AdminShell from "@/components/admin/AdminShell";

export const dynamic = "force-dynamic";

/**
 * تخطيط لوحة الإدارة المحميّ (Server Component).
 * - requireAdminPage() يوجّه إلى /admin/login تلقائيًا عند انعدام الجلسة أو الصلاحية.
 * - هذه المجموعة `(panel)` لا تشمل /admin/login لتجنّب الحماية الدائرية.
 */
export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  return (
    <AdminShell
      admin={{
        name: admin.name,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
      }}
    >
      {children}
    </AdminShell>
  );
}
