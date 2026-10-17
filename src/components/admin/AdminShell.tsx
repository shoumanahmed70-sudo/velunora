"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ExternalLink,
  FileText,
  Home,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ScrollText,
  Settings,
  ShoppingBag,
  Tags,
  UserCog,
  Users,
  X,
} from "lucide-react";
import { useMe } from "@/lib/auth-provider";
import { useStore } from "@/lib/store-provider";
import type { AdminPermission, AdminRole } from "@/lib/types";

export interface AdminShellUser {
  name: string;
  email: string;
  role: AdminRole;
  permissions: AdminPermission[];
}

type NavPerm = AdminPermission | "owner" | null;

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  perm: NavPerm;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, perm: null },
  { href: "/admin/help", label: "دليل الاستخدام", icon: BookOpen, perm: null },
  { href: "/admin/account", label: "حسابي وكلمة المرور", icon: KeyRound, perm: null },
  { href: "/admin/products", label: "المنتجات", icon: Package, perm: "products" },
  { href: "/admin/orders", label: "الطلبات", icon: ShoppingBag, perm: "orders" },
  { href: "/admin/customers", label: "العملاء", icon: Users, perm: "customers" },
  { href: "/admin/homepage", label: "الصفحة الرئيسية", icon: Home, perm: "home" },
  { href: "/admin/content", label: "المحتوى والسياسات", icon: FileText, perm: "pages" },
  { href: "/admin/categories", label: "الأقسام", icon: Tags, perm: "products" },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings, perm: "settings" },
  { href: "/admin/audit", label: "سجل التدقيق", icon: ScrollText, perm: "audit" },
  { href: "/admin/staff", label: "الموظفون", icon: UserCog, perm: "owner" },
];

const ROLE_LABELS: Record<AdminRole, string> = {
  owner: "مالك المتجر",
  staff: "موظف",
};

export default function AdminShell({
  admin,
  children,
}: {
  admin: AdminShellUser;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings } = useStore();
  const { me, loading, logout } = useMe();
  const [open, setOpen] = useState(false);
  const [rtl, setRtl] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // اتجاه الصفحة — لوحة الإدارة عربية لكن نراعي اتجاه الوثيقة الفعلي
  useEffect(() => {
    setRtl(document.documentElement.dir !== "ltr");
  }, []);

  // حماية إضافية على الواجهة (الحماية الحقيقية على الخادم)
  useEffect(() => {
    if (!loading && !me?.admin) router.push("/admin/login");
  }, [loading, me, router]);

  // إغلاق الشريط الجانبي عند تغيير المسار
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function canSee(perm: NavPerm): boolean {
    if (perm === null) return true;
    if (admin.role === "owner") return true;
    if (perm === "owner") return false;
    return admin.permissions.includes(perm);
  }

  function isActive(href: string): boolean {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      router.push("/admin/login");
    }
  }

  const storeName = settings?.storeName || "VELUNORA";
  const hiddenTransform = rtl ? "translate-x-full" : "-translate-x-full";

  return (
    <div className="min-h-screen bg-cream text-ink">
      {/* خلفية معتمة للجوال */}
      {open ? (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden no-print"
        />
      ) : null}

      {/* الشريط الجانبي */}
      <aside
        className={`fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-primary text-white shadow-2xl transition-transform duration-300 ease-luxe lg:translate-x-0 no-print ${
          open ? "translate-x-0" : hiddenTransform
        }`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-5">
          <Link href="/admin" className="flex flex-col leading-tight">
            <span className="display text-2xl font-bold tracking-wide text-gold-soft">{storeName}</span>
            <span className="text-[11px] text-white/60">لوحة الإدارة</span>
          </Link>
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setOpen(false)}
            className="rounded-full p-2 hover:bg-white/10 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV.filter((item) => canSee(item.perm)).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-semibold transition-all duration-300 ease-luxe ${
                  active
                    ? "border-gold bg-gold/20 text-white"
                    : "border-transparent text-white/75 hover:border-white/10 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-gold-soft" : "text-white/70"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4 text-xs text-white/60">
          <p className="font-semibold text-white/85">{admin.name}</p>
          <p className="mt-0.5 truncate">{admin.email}</p>
          <p className="mt-1 inline-flex rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-gold-soft">
            {ROLE_LABELS[admin.role]}
          </p>
        </div>
      </aside>

      {/* منطقة المحتوى */}
      <div className="flex min-h-screen flex-col lg:ps-72">
        {/* الشريط العلوي */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-white/95 px-4 py-3 backdrop-blur no-print sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="فتح القائمة"
              onClick={() => setOpen(true)}
              className="rounded-xl border border-line p-2 text-ink hover:bg-cream lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="leading-tight">
              <p className="text-sm font-extrabold text-ink">{storeName}</p>
              <p className="text-[11px] text-muted">لوحة الإدارة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-end sm:block">
              <p className="text-sm font-semibold text-ink">{admin.name}</p>
              <p className="text-[11px] text-muted">{ROLE_LABELS[admin.role]}</p>
            </div>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline min-h-11 px-4 py-2 text-xs"
              title="فتح واجهة المتجر في تبويب جديد"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">زيارة المتجر</span>
            </a>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="btn btn-ghost min-h-11 border border-transparent px-4 py-2 text-xs text-ink hover:border-line"
              title="تسجيل الخروج"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">تسجيل الخروج</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
