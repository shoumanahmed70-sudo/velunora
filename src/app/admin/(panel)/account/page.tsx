"use client";

import { useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { AdminHeading, Field, Panel, inputCls } from "@/components/admin/ui";

const ROLE_LABELS: Record<string, string> = {
  owner: "مالك المتجر",
  staff: "موظف",
};

/** حسابي: بيانات الحساب + تغيير كلمة المرور (متاح لكل مدير نشط). */
export default function AdminAccountPage() {
  const toast = useToast();
  const { me } = useMe();
  const admin = me?.admin ?? null;

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!current) {
      setError("أدخل كلمة المرور الحالية");
      return;
    }
    if (next.length < 8) {
      setError("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (next !== confirm) {
      setError("كلمتا المرور الجديدتان غير متطابقتين");
      return;
    }

    setBusy(true);
    try {
      await api.post("/api/account/password", { currentPassword: current, newPassword: next });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast("تم تغيير كلمة المرور بنجاح", "success");
    } catch (err) {
      setError(errorMessage(err, "تعذّر تغيير كلمة المرور"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <AdminHeading
        title="حسابي"
        description="بيانات حسابك في لوحة الإدارة وكلمة المرور"
      />

      <div className="grid gap-6 lg:max-w-3xl">
        <Panel>
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary text-gold-soft">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink">{me?.admin?.name || me?.user?.name || "—"}</p>
              <p className="mt-0.5 text-xs text-muted" dir="ltr">
                {me?.admin?.email || me?.user?.email || "—"}
              </p>
              <p className="mt-2 inline-flex rounded-full bg-cream px-2.5 py-0.5 text-[11px] font-semibold text-ink">
                {ROLE_LABELS[me?.admin?.role || ""] || "—"}
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <form onSubmit={submit} className="space-y-5">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gold" />
              <h2 className="text-base font-bold text-ink">تغيير كلمة المرور</h2>
            </div>

            <p className="rounded-xl border border-line bg-cream/40 px-4 py-3 text-xs leading-6 text-muted">
              كلمة المرور هذه هي نفسها كلمة مرور الدخول إلى لوحة الإدارة. تُحفظ مشفّرة ولا يمكن
              استرجاعها، ولن تُطلب منك مرة أخرى بعد التغيير إلا عند الدخول التالي.
            </p>

            <Field label="كلمة المرور الحالية" required>
              <input
                className={`${inputCls} text-start`}
                dir="ltr"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="كلمة المرور الجديدة" required hint="8 أحرف على الأقل">
                <input
                  className={`${inputCls} text-start`}
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  value={next}
                  onChange={(e) => setNext(e.target.value)}
                />
              </Field>
              <Field label="تأكيد كلمة المرور الجديدة" required>
                <input
                  className={`${inputCls} text-start`}
                  dir="ltr"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
            </div>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm font-semibold text-red-800">
                {error}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="btn btn-primary min-h-11" disabled={busy}>
                {busy ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
              </button>
              <p className="text-xs text-muted">
                يُسجَّل هذا الإجراء في سجل التدقيق باسم حسابك.
              </p>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
