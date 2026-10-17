"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/lib/i18n/provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { readLastOrder } from "@/lib/local-store";
import { formatMoney } from "@/lib/money";
import type { PublicOrder } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { EmptyState } from "@/components/shop/EmptyState";
import { OrderInvoice } from "@/components/shop/OrderInvoice";
import { CheckIcon, WhatsappIcon } from "@/components/shop/icons";
import { STATUS_TONE, statusLabelKey } from "@/components/shop/orderStatus";
import { L, PLACEHOLDER, productImage } from "@/components/shop/utils";

interface LookupResponse {
  order: PublicOrder;
  /** يوفّره الخادم لفتح واتساب؛ لا يُبنى يدويًا في الواجهة. */
  waUrl?: string;
  waMessage?: string;
}

interface LastOrder {
  number: string;
  phone: string;
  /** رابط ونص رسالة واتساب كما أعادهما الخادم عند إنشاء الطلب. */
  waUrl?: string;
  waMessage?: string;
}

function buildFallbackMessage(order: PublicOrder, storeName: string, symbol: string): string {
  const money = (n: number) => `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n)} ${symbol}`;
  const lines: string[] = [];
  lines.push(`*طلب جديد — ${storeName}*`);
  lines.push(`رقم الطلب: ${order.number}`);
  lines.push("");
  lines.push("*المنتجات:*");
  order.items.forEach((item, i) => {
    const variant = item.variantLabel ? ` — ${item.variantLabel}` : "";
    lines.push(`${i + 1}) ${item.name}${variant} — ${item.qty} × ${money(item.unitPrice)} = ${money(item.total)}`);
  });
  lines.push("");
  lines.push(`*الإجمالي: ${money(order.total)}*`);
  lines.push(`الاسم: ${order.customer.name}`);
  lines.push(`الجوال: ${order.customer.phone}`);
  lines.push(`المدينة: ${order.customer.city}`);
  lines.push(`العنوان: ${order.customer.address}`);
  if (order.customer.notes) lines.push(`ملاحظات: ${order.customer.notes}`);
  return lines.join("\n");
}

export default function OrderConfirmationPage() {
  const { lang } = useLang();
  const t = useT();
  const api = useApi();
  const { me } = useMe();
  const uid = me?.user?.uid ?? null;
  const { settings, contactWaUrl } = useStoreSafe();

  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [waUrl, setWaUrl] = useState("");
  const [waMessage, setWaMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [noStored, setNoStored] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    // آخر طلب يخصّ صاحب الحساب الحالي (أو الزائر) — لا يتسرّب بين العملاء
    const stored: LastOrder | null = readLastOrder(uid);

    if (!stored?.number || !stored?.phone) {
      setNoStored(true);
      setLoading(false);
      return;
    }

    // القيم التي أرجعها الخادم عند إنشاء الطلب (رابط/نص واتساب)
    setWaUrl(stored.waUrl || "");
    setWaMessage(stored.waMessage || "");
    setPhone(stored.phone || "");

    try {
      const res = await api.post<LookupResponse>("/api/orders/lookup", {
        number: stored.number,
        phone: stored.phone,
      });
      setOrder(res.order);
      // إن أعاد الخادم الرابط/النص نستخدمه، وإلا نعتمد على ما خزّناه من إنشاء الطلب.
      if (res.waUrl) setWaUrl(res.waUrl);
      if (res.waMessage) setWaMessage(res.waMessage);
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setLoading(false);
    }
  }, [api, t, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  const storeName = settings?.storeName || "VELUNORA";
  const symbol = settings?.currencySymbol || "";
  const message = waMessage || (order ? buildFallbackMessage(order, storeName, symbol) : "");

  async function copyMessage() {
    if (!message) return;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <span
          className="spinner mx-auto block"
          style={{ borderColor: "var(--vc-line)", borderTopColor: "var(--vc-gold)" }}
        />
        <p className="mt-4 text-sm text-muted">{t("loading")}</p>
      </div>
    );
  }

  if (noStored) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title={L(lang, "لا يوجد طلب حديث لعرضه", "No recent order to display")}
          hint={t("lookupByPhone")}
          action={
            <>
              <Link href="/order/lookup" className="btn btn-primary min-h-11">
                {t("orderLookup")}
              </Link>
              <Link href="/" className="btn btn-outline min-h-11">
                {t("backHome")}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title={t("error")}
          hint={error}
          action={
            <>
              <button type="button" onClick={() => void load()} className="btn btn-primary min-h-11">
                {t("retry")}
              </button>
              <Link href="/order/lookup" className="btn btn-outline min-h-11">
                {t("orderLookup")}
              </Link>
            </>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      {/* نجاح */}
      <div className="card-lux p-6 text-center sm:p-8">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckIcon size={30} />
        </div>
        <h1 className="display mt-4 text-3xl font-semibold text-ink sm:text-4xl">{t("orderSuccessTitle")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted">{t("orderSavedNote")}</p>

        {order && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-cream px-5 py-2 text-sm">
            <span className="text-muted">{t("orderNumber")}:</span>
            <span className="font-bold text-primary" dir="ltr">
              {order.number}
            </span>
          </p>
        )}
      </div>

      {/* إرسال واتساب */}
      <div className="card-lux mt-6 space-y-4 p-6">
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {t("pressSendHint")}
        </p>

        {waUrl ? (
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="btn btn-gold min-h-12 w-full">
            <WhatsappIcon size={20} />
            {t("openWhatsapp")}
          </a>
        ) : (
          <button type="button" disabled className="btn btn-gold min-h-12 w-full">
            <WhatsappIcon size={20} />
            {t("openWhatsapp")}
          </button>
        )}

        <button type="button" onClick={copyMessage} disabled={!message} className="btn btn-outline min-h-11 w-full">
          {copied ? t("copied") : t("copyOrderMessage")}
        </button>

        <div className="rounded-xl border border-line bg-cream/60 p-4">
          <p className="text-xs font-semibold text-ink">{t("whatsappUnavailable")}</p>
          {settings?.contact?.phone && (
            <p className="mt-1 text-sm font-bold text-primary" dir="ltr">
              {settings.contact.phone}
            </p>
          )}
          {message && (
            <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-muted">
              {message}
            </pre>
          )}
          {contactWaUrl && (
            <a
              href={contactWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost mt-3 min-h-11 w-full"
            >
              <WhatsappIcon size={18} />
              {t("whatsappContact")}
            </a>
          )}
        </div>
      </div>

      {/* تفاصيل الطلب */}
      {order && (
        <div className="card-lux mt-6 p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-ink">{t("orderDetails")}</h2>
            <span className={`chip ${STATUS_TONE[order.status]}`}>{t(statusLabelKey(order.status))}</span>
          </div>

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
        </div>
      )}

      {/* الفاتورة: طباعة/حفظ PDF + إرسال بالبريد */}
      {order ? <OrderInvoice order={order} phone={phone} /> : null}

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/account/orders" className="btn btn-outline min-h-11">
          {t("myOrdersCta")}
        </Link>
        <Link href="/" className="btn btn-ghost min-h-11">
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
