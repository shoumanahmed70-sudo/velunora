"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { AuthShell } from "@/components/shop/AuthShell";
import { GoogleButton } from "@/components/shop/GoogleButton";

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const { refresh } = useMe();
  const params = useSearchParams();
  const next = params.get("next") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError(t("requiredField"));
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/auth/login", { email: email.trim(), password });
      await refresh();
      router.push(next || "/account");
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("login")}
      subtitle={t("account")}
      footer={
        <>
          <span>{t("noAccount")} </span>
          <Link
            href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
            className="font-semibold text-primary hover:text-gold"
          >
            {t("register")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="login-email">
            {t("email")}
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="login-password">
            {t("password")}
          </label>
          <input
            id="login-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="current-password"
          />
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="text-end">
          <Link href="/auth/forgot" className="text-xs font-semibold text-primary hover:text-gold">
            {t("forgotPassword")}
          </Link>
        </div>

        <button type="submit" disabled={busy} className="btn btn-primary min-h-11 w-full">
          {busy ? t("loading") : t("login")}
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

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
