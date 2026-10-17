"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useMe } from "@/lib/auth-provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";
import type { PublicOrder } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { EmptyState } from "@/components/shop/EmptyState";
import { OrderInvoice } from "@/components/shop/OrderInvoice";
import { STATUS_TONE, statusLabelKey } from "@/components/shop/orderStatus";
import { L, PLACEHOLDER, productImage } from "@/components/shop/utils";

function formatDateTime(ts: number, lang: "ar" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export default function AccountOrderDetailPage() {
  const { lang } = useLang();
  const t = useT();
  const router = useRouter();
  const params = useParams<{ number: string }>();
  const number = decodeURIComponent(params?.number || "");
  const api = useApi();
  const { me, loading: meLoading } = useMe();
  const { settings } = useStoreSafe();

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!meLoading && me && !me.user) {
      router.replace(`/auth/login?next=/account/orders/${encodeURIComponent(number)}`);
    }
  }, [meLoading, me, router, number]);

  useEffect(() => {
    if (meLoading || !me?.user || !number) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get<{ order: PublicOrder }>(`/api/account/orders/${encodeURIComponent(number)}`);
        if (!cancelled) setOrder(res.order);
      } catch (err) {
        if (!cancelled) setError(errorMessage(err, t("errGeneric")));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [meLoading, me, api, t, number]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href="/account/orders" className="text-sm font-semibold text-primary hover:text-gold">
        {t("back")}
      </Link>

      {loading ? (
        <p className="mt-8 text-sm text-muted">{t("loading")}</p>
      ) : error ? (
        <div className="mt-8">
          <EmptyState title={t("error")} hint={error} />
        </div>
      ) : order ? (
        <div className="card-lux mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="display text-2xl font-semibold text-ink">{t("orderDetails")}</h1>
              <p className="mt-1 text-sm font-bold text-primary" dir="ltr">
                {order.number}
              </p>
              <p className="mt-1 text-xs text-muted">{formatDateTime(order.createdAt, lang)}</p>
            </div>
            <span className={`chip ${STATUS_TONE[order.status]}`}>{t(statusLabelKey(order.status))}</span>
          </div>

          <ul className="mt-5 divide-y divide-line">
            {order.items.map((item, i) => (
              <li key={`${item.productId}-${i}`} className="flex items-center gap-3 py-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={productImage(item.image ? [item.image] : null)}
                  alt={L(lang, item.name, item.nameEn)}
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-12 shrink-0 rounded-lg border border-line object-cover"
                  onError={(e) => {
                    e.currentTarget.src = PLACEHOLDER;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-ink">{L(lang, item.name, item.nameEn)}</p>
                  <p className="text-xs text-muted">
                    {item.variantLabel || ""} <span className="mx-1">×</span>
                    {item.qty}
                  </p>
                </div>
                <span className="text-sm font-semibold text-ink">{formatMoney(item.total, settings)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">{t("subtotal")}</dt>
              <dd className="font-semibold text-ink">{formatMoney(order.subtotal, settings)}</dd>
            </div>
            {order.discount > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("discount")}</dt>
                <dd className="font-semibold text-emerald-700">-{formatMoney(order.discount, settings)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between">
              <dt className="text-muted">{t("shipping")}</dt>
              <dd className="font-semibold text-ink">
                {order.shipping > 0 ? formatMoney(order.shipping, settings) : t("free")}
              </dd>
            </div>
            {order.tax > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">{t("tax")}</dt>
                <dd className="font-semibold text-ink">{formatMoney(order.tax, settings)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line pt-3">
              <dt className="font-bold text-ink">{t("total")}</dt>
              <dd className="text-lg font-bold text-primary">{formatMoney(order.total, settings)}</dd>
            </div>
          </dl>

          <div className="mt-5 rounded-xl bg-cream/60 p-4 text-sm">
            <p className="mb-2 text-xs font-bold text-ink">{t("contactInfo")}</p>
            <p className="text-ink">{order.customer.name}</p>
            <p className="text-muted" dir="ltr">
              {order.customer.phone}
            </p>
            <p className="text-muted">
              {order.customer.city} — {order.customer.address}
            </p>
            {order.customer.notes && <p className="mt-1 text-muted">{order.customer.notes}</p>}
          </div>
        </div>
      ) : null}

      {order ? <OrderInvoice order={order} /> : null}
    </div>
  );
}
