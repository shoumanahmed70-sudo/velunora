"use client";

import Link from "next/link";
import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { AuthShell } from "@/components/shop/AuthShell";

export default function ForgotPage() {
  const t = useT();
  const api = useApi();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError(t("requiredField"));
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ ok: boolean; devResetLink?: string }>("/api/auth/forgot", {
        email: email.trim(),
      });
      setSent(true);
      setDevLink(res.devResetLink || "");
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("resetPassword")}
      footer={
        <Link href="/auth/login" className="font-semibold text-primary hover:text-gold">
          {t("back")}
        </Link>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t("resetEmailSent")}</p>
          {devLink && (
            <div className="rounded-xl border border-line bg-cream/60 p-4 text-xs">
              <p className="font-semibold text-ink">{t("devResetLink")}</p>
              <Link href={devLink} className="mt-1 block break-all font-semibold text-primary underline">
                {devLink}
              </Link>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="field-label" htmlFor="forgot-email">
              {t("email")}
            </label>
            <input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              dir="ltr"
              autoComplete="email"
            />
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary min-h-11 w-full">
            {busy ? t("loading") : t("sendResetLink")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
