"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, Mail, ShieldAlert } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useStore } from "@/lib/store-provider";
import { inputCls } from "@/components/admin/ui";
import type { MeResponse } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const { settings } = useStore();
  const { me, refresh, logout, loading: meLoading } = useMe();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!meLoading && me?.admin) {
      router.replace("/admin");
    }
  }, [me?.admin, meLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (!email.trim() || !password) {
      setError("أدخل البريد الإلكتروني وكلمة المرور");
      return;
    }

    setBusy(true);
    try {
      await api.post("/api/auth/login", { email: email.trim(), password });
      await refresh();

      // نتأكد مباشرة من صلاحية الإدارة بدل الاعتماد على الحالة المخزّنة
      const current = await api.get<MeResponse>("/api/auth/me");
      if (current.admin) {
        router.push("/admin");
        return;
      }

      // الحساب صالح لكنه ليس مديرًا — لا نكشف أي تفاصيل ونُخرج الجلسة
      setError("هذا الحساب لا يملك صلاحية الوصول إلى لوحة الإدارة");
      await logout();
    } catch (err) {
      setError(errorMessage(err, "تعذّر تسجيل الدخول، حاول مرة أخرى"));
    } finally {
      setBusy(false);
    }
  }

  const storeName = settings?.storeName || "VELUNORA";

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-md">
        {/* تحذير أعلى الصفحة */}
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-300/50 bg-amber-50/95 px-4 py-3 text-sm text-amber-900 shadow-lg">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="leading-6">
            منطقة إدارة محميّة — لا يوجد تسجيل مدير من الموقع العام.
          </p>
        </div>

        <div className="rounded-3xl border border-gold/30 bg-white p-7 shadow-2xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-gold-soft">
              <Lock className="h-7 w-7" />
            </div>
            <h1 className="display text-3xl font-bold tracking-wide text-ink">{storeName}</h1>
            <p className="mt-1 text-sm text-muted">لوحة الإدارة السرّية</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <Mail className="h-4 w-4 text-gold" /> البريد الإلكتروني
              </span>
              <input
                type="email"
                dir="ltr"
                autoComplete="username"
                className={`${inputCls} text-start`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-ink">
                <KeyRound className="h-4 w-4 text-gold" /> كلمة المرور
              </span>
              <input
                type="password"
                dir="ltr"
                autoComplete="current-password"
                className={`${inputCls} text-start`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn btn-primary min-h-12 w-full py-3.5 text-base"
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {busy ? "جارٍ الدخول…" : "دخول"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs leading-6 text-muted">
            الدخول مخصّص للمدراء المصرّح لهم فقط. لا يوجد إنشاء حساب أو إعادة تعيين كلمة المرور من هنا.
          </p>
        </div>
      </div>
    </div>
  );
}
