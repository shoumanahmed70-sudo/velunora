"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { PublicOrder } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { EmptyState } from "@/components/shop/EmptyState";
import { STATUS_TONE, statusLabelKey } from "@/components/shop/orderStatus";

function formatDate(ts: number, lang: "ar" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export default function AccountOrdersPage() {
  const { lang } = useLang();
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const { me, loading: meLoading } = useMe();
  const { settings } = useStoreSafe();

  const [orders, setOrders] = useState<PublicOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!meLoading && me && !me.user) {
      router.replace("/auth/login?next=/account/orders");
    }
  }, [meLoading, me, router]);

  useEffect(() => {
    if (meLoading || !me?.user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<{ orders: PublicOrder[] }>("/api/account/orders");
        if (!cancelled) setOrders(res.orders || []);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("myOrders")}</h1>
        <Link href="/account" className="btn btn-outline min-h-11">
          {t("profile")}
        </Link>
      </div>

      {meLoading || (me?.user && loading) ? (
        <p className="mt-8 text-sm text-muted">{t("loading")}</p>
      ) : error ? (
        <p className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("noOrders")}
            action={
              <Link href="/products" className="btn btn-primary min-h-11">
                {t("startShopping")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/account/orders/${encodeURIComponent(order.number)}`}
              className="card-lux flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-bold text-primary" dir="ltr">
                  {order.number}
                </span>
                <span className="text-xs text-muted">{formatDate(order.createdAt, lang)}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`chip ${STATUS_TONE[order.status]}`}>{t(statusLabelKey(order.status))}</span>
                <span className="text-sm font-bold text-ink">{formatMoney(order.total, settings)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
