"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n/provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { formatMoney, normalizeDigits } from "@/lib/money";
import type { PublicOrder } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { OrderInvoice } from "@/components/shop/OrderInvoice";
import { STATUS_TONE, statusLabelKey } from "@/components/shop/orderStatus";
import { L, PLACEHOLDER, productImage } from "@/components/shop/utils";

function formatDate(ts: number, lang: "ar" | "en"): string {
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

export default function OrderLookupPage() {
  const { lang } = useLang();
  const t = useT();
  const api = useApi();
  const { settings } = useStoreSafe();

  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOrder(null);
    if (!number.trim() || !phone.trim()) {
      setError(t("requiredField"));
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ order: PublicOrder }>("/api/orders/lookup", {
        number: number.trim(),
        phone: normalizeDigits(phone.trim()),
      });
      setOrder(res.order);
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("orderLookup")}</h1>
      <p className="mt-2 text-sm text-muted">{t("lookupByPhone")}</p>

      <form onSubmit={onSubmit} className="card-lux mt-6 space-y-5 p-6">
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="lk-number">
              {t("orderNumber")}
            </label>
            <input
              id="lk-number"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              className="field text-start"
              dir="ltr"
              placeholder="VN-1001"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lk-phone">
              {t("phone")}
            </label>
            <input
              id="lk-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field text-start"
              dir="ltr"
              inputMode="tel"
            />
          </div>
        </div>

        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary min-h-11 w-full">
          {loading ? t("loading") : t("search")}
        </button>
      </form>

      {order && (
        <div className="card-lux mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted">{t("orderNumber")}</p>
              <p className="text-lg font-bold text-primary" dir="ltr">
                {order.number}
              </p>
            </div>
            <span className={`chip ${STATUS_TONE[order.status]}`}>{t(statusLabelKey(order.status))}</span>
          </div>

          <p className="mt-2 text-xs text-muted">{formatDate(order.createdAt, lang)}</p>

          <ul className="mt-4 divide-y divide-line">
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

          {order.customer?.name && (
            <div className="mt-4 rounded-xl bg-cream/60 p-4 text-sm">
              <p className="font-semibold text-ink">{order.customer.name}</p>
              <p className="text-muted" dir="ltr">
                {order.customer.phone}
              </p>
              <p className="text-muted">
                {order.customer.city} — {order.customer.address}
              </p>
            </div>
          )}
        </div>
      )}

      {order ? <OrderInvoice order={order} phone={phone} /> : null}

      <div className="mt-6 text-center">
        <Link href="/" className="btn btn-ghost min-h-11">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
