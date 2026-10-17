"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { AuthShell } from "@/components/shop/AuthShell";
import { CheckIcon } from "@/components/shop/icons";

type Status = "verifying" | "success" | "error";

function VerifyInner() {
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const { refresh } = useMe();
  const params = useSearchParams();
  const token = params.get("token") || "";
  const next = params.get("next") || "";

  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState("");
  const [devLink, setDevLink] = useState("");
  const [busy, setBusy] = useState(false);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    if (!token) {
      setStatus("error");
      setError(t("invalidResetLink"));
      return;
    }

    (async () => {
      try {
        await api.post("/api/auth/verify", { token });
        setStatus("success");
        await refresh();
        router.push(next || "/account");
      } catch (err) {
        setStatus("error");
        setError(errorMessage(err, t("invalidResetLink")));
      }
    })();
  }, [api, token, next, refresh, router, t]);

  async function resend() {
    setBusy(true);
    setDevLink("");
    try {
      const res = await api.post<{ ok: boolean; devVerifyLink?: string }>("/api/auth/resend-verification");
      setDevLink(res.devVerifyLink || "");
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={t("verificationSent")}
      footer={
        <Link href="/auth/login" className="font-semibold text-primary hover:text-gold">
          {t("login")}
        </Link>
      }
    >
      {status === "verifying" && <p className="text-center text-sm text-muted">{t("loading")}</p>}

      {status === "success" && (
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckIcon size={26} />
          </div>
          <p className="text-sm text-emerald-800">{t("verificationSent")}</p>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4">
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          <button type="button" onClick={resend} disabled={busy} className="btn btn-outline min-h-11 w-full">
            {busy ? t("loading") : t("resendVerification")}
          </button>
          {devLink && (
            <div className="rounded-xl border border-line bg-cream/60 p-4 text-xs">
              <p className="font-semibold text-ink">{t("devResetLink")}</p>
              <Link href={devLink} className="mt-1 block break-all font-semibold text-primary underline">
                {devLink}
              </Link>
            </div>
          )}
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyInner />
    </Suspense>
  );
}
