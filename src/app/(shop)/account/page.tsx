"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { useApi, errorMessage } from "@/lib/api-client";
import type { CustomerProfile } from "@/lib/types";
import { AuthShell } from "@/components/shop/AuthShell";

export default function AccountPage() {
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { me, loading: meLoading, logout } = useMe();

  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");

  // تغيير كلمة المرور
  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNext, setPwNext] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  // توجيه غير المسجّل إلى صفحة الدخول
  useEffect(() => {
    if (!meLoading && me && !me.user) {
      router.replace("/auth/login?next=/account");
    }
  }, [meLoading, me, router]);

  useEffect(() => {
    if (meLoading) return;
    if (!me?.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<{ profile: CustomerProfile }>("/api/account");
        if (cancelled) return;
        const p = res.profile;
        setProfile(p);
        setName(p.name || "");
        setPhone(p.phone || "");
        setCity(p.city || "");
        setAddress(p.address || "");
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, t("errGeneric")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meLoading, me, api, t]);

  async function changePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    if (!pwCurrent) {
      setPwError(t("currentPassword"));
      return;
    }
    if (pwNext.length < 8) {
      setPwError(t("weakPassword"));
      return;
    }
    if (pwNext !== pwConfirm) {
      setPwError(t("passwordMismatch"));
      return;
    }
    setPwSaving(true);
    try {
      await api.post("/api/account/password", { currentPassword: pwCurrent, newPassword: pwNext });
      setPwCurrent("");
      setPwNext("");
      setPwConfirm("");
      toast(t("passwordChanged"), "success");
    } catch (err) {
      setPwError(errorMessage(err, t("errGeneric")));
    } finally {
      setPwSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await api.put<{ profile: CustomerProfile }>("/api/account", {
        name: name.trim(),
        phone: phone.trim(),
        city: city.trim(),
        address: address.trim(),
      });
      setProfile(res.profile);
      toast(t("saved"), "success");
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || (me?.user && loading)) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-muted">{t("loading")}</p>
      </div>
    );
  }

  if (!me?.user) return null;

  if (profile?.disabled) {
    return (
      <AuthShell title={t("accountTitle")}>
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("accountDisabled")}
        </p>
        <button
          type="button"
          onClick={() => void logout()}
          className="btn btn-outline mt-4 min-h-11 w-full"
        >
          {t("logout")}
        </button>
      </AuthShell>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("accountTitle")}</h1>
        <div className="flex items-center gap-2">
          <Link href="/account/orders" className="btn btn-outline min-h-11">
            {t("myOrders")}
          </Link>
          <button type="button" onClick={() => void logout()} className="btn btn-ghost min-h-11">
            {t("logout")}
          </button>
        </div>
      </div>

      <div className="card-lux mt-6 p-6">
        <p className="text-sm text-muted">{me.user.email}</p>

        <form onSubmit={onSubmit} className="mt-5 space-y-5">
          <h2 className="text-base font-bold text-ink">{t("personalInfo")}</h2>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="ac-name">
                {t("fullName")}
              </label>
              <input id="ac-name" value={name} onChange={(e) => setName(e.target.value)} className="field" />
            </div>
            <div>
              <label className="field-label" htmlFor="ac-phone">
                {t("phone")}
              </label>
              <input
                id="ac-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="field text-start"
                dir="ltr"
                inputMode="tel"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="ac-city">
                {t("city")}
              </label>
              <input id="ac-city" value={city} onChange={(e) => setCity(e.target.value)} className="field" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="ac-address">
                {t("savedAddress")}
              </label>
              <input
                id="ac-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="field"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={saving} className="btn btn-primary min-h-11">
              {saving ? t("sending") : t("saveChanges")}
            </button>
            <Link href="/order/lookup" className="btn btn-ghost min-h-11">
              {t("orderLookup")}
            </Link>
          </div>
        </form>
      </div>

      <div className="card-lux mt-6 p-6">
        <h2 className="text-base font-bold text-ink">{t("changePassword")}</h2>
        <form onSubmit={changePw} className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="pw-current">
                {t("currentPassword")}
              </label>
              <input
                id="pw-current"
                type="password"
                dir="ltr"
                autoComplete="current-password"
                className="field text-start"
                value={pwCurrent}
                onChange={(e) => setPwCurrent(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="pw-next">
                {t("password")}
              </label>
              <input
                id="pw-next"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                className="field text-start"
                value={pwNext}
                onChange={(e) => setPwNext(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="pw-confirm">
                {t("confirmPassword")}
              </label>
              <input
                id="pw-confirm"
                type="password"
                dir="ltr"
                autoComplete="new-password"
                className="field text-start"
                value={pwConfirm}
                onChange={(e) => setPwConfirm(e.target.value)}
              />
            </div>
          </div>

          {pwError && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {pwError}
            </p>
          )}

          <button type="submit" disabled={pwSaving} className="btn btn-primary min-h-11">
            {pwSaving ? t("sending") : t("changePassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
