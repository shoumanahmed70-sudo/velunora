"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { useApi, errorMessage } from "@/lib/api-client";
import { AuthShell } from "@/components/shop/AuthShell";

function ResetForm() {
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { refresh } = useMe();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const next = params.get("next") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!token) {
      setError(t("invalidResetLink"));
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
      await api.post("/api/auth/reset", { token, password });
      toast(t("resetDone"), "success");
      await refresh();
      router.push(next || "/account");
    } catch (err) {
      setError(errorMessage(err, t("invalidResetLink")));
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title={t("resetPassword")}
        footer={
          <Link href="/auth/forgot" className="font-semibold text-primary hover:text-gold">
            {t("sendResetLink")}
          </Link>
        }
      >
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t("invalidResetLink")}
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("resetPassword")}
      footer={
        <Link href="/auth/login" className="font-semibold text-primary hover:text-gold">
          {t("login")}
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="field-label" htmlFor="reset-password">
            {t("password")}
          </label>
          <input
            id="reset-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field"
            dir="ltr"
            autoComplete="new-password"
          />
        </div>
        <div>
          <label className="field-label" htmlFor="reset-confirm">
            {t("confirmPassword")}
          </label>
          <input
            id="reset-confirm"
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
          {busy ? t("loading") : t("resetPassword")}
        </button>
      </form>
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
