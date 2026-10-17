"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { AuthShell } from "@/components/shop/AuthShell";
import { GoogleButton } from "@/components/shop/GoogleButton";

function RegisterForm() {
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const { refresh } = useMe();
  const params = useSearchParams();
  const next = params.get("next") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim() || !email.trim() || !password) {
      setError(t("requiredField"));
      return;
    }
    if (password.length < 6) {
      setError(t("weakPassword"));
      return;
    }
    if (password !== confirm) {
      setError(t("passwordMismatch"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/register", {
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim() || undefined,
      });
      await refresh();
      router.push(next || "/account");
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("register")}
      subtitle={t("account")}
      footer={
        <>
          <span>{t("haveAccount")} </span>
          <Link
            href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-primary hover:text-gold"
          >
            {t("login")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="reg-name">
            {t("fullNameLabel")}
          </label>
          <input
            id="reg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="reg-email">
            {t("email")}
          </label>
          <input
            id="reg-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="reg-phone">
            {t("phone")} <span className="text-muted">({t("optional")})</span>
          </label>
          <input
            id="reg-phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="field text-start"
            dir="ltr"
            inputMode="tel"
            autoComplete="tel"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="reg-password">
            {t("password")}
          </label>
          <input
            id="reg-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="reg-confirm">
            {t("confirmPassword")}
          </label>
          <input
            id="reg-confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={busy} className="btn btn-primary min-h-11 w-full">
          {busy ? t("loading") : t("register")}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        {t("or")}
        <span className="h-px flex-1 bg-line" />
      </div>

      <GoogleButton next={next} />
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterForm />
    </Suspense>
  );
}
