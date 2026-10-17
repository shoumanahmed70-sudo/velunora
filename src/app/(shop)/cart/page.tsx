"use client";

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart-provider";
import { formatMoney } from "@/lib/money";
import { useCartDetails } from "@/components/shop/useCartDetails";
import { EmptyState } from "@/components/shop/EmptyState";
import { QtyStepper } from "@/components/shop/QtyStepper";
import { CartIcon } from "@/components/shop/icons";
import { L, PLACEHOLDER, localizedName, productImage } from "@/components/shop/utils";

export default function CartPage() {
  const { lang } = useLang();
  const t = useT();
  const { lines, ready, setQty, remove } = useCart();
  const { rows, totals, loading, error, settings } = useCartDetails();

  const ordersEnabled = settings ? settings.ordersEnabled : true;
  const freeShippingOver = settings?.freeShippingOver ?? null;
  const minOrder = settings?.minOrder ?? 0;

  const belowFreeShipping = freeShippingOver != null && totals.net < freeShippingOver;
  const remainingForFree = freeShippingOver != null ? Math.max(0, freeShippingOver - totals.net) : 0;
  const belowMinOrder = minOrder > 0 && totals.net < minOrder;
  const canCheckout = lines.length > 0 && ordersEnabled && !belowMinOrder;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("cartTitle")}</h1>

      {!ready ? (
        <p className="mt-8 text-sm text-muted">{t("loading")}</p>
      ) : lines.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={t("cartEmpty")}
            hint={t("cartEmptyCta")}
            icon={<CartIcon size={26} />}
            action={
              <Link href="/products" className="btn btn-primary min-h-11">
                {t("continueShopping")}
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          {/* العناصر */}
          <div className="space-y-4">
            {rows.map((row) => {
              const name = row.product ? localizedName(row.product, lang) : "";
              return (
                <div key={row.key} className="card-lux flex gap-4 p-3 sm:p-4">
                  <Link
                    href={row.product ? `/product/${row.product.slug}` : "/products"}
                    className="shrink-0 overflow-hidden rounded-xl border border-line bg-cream"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={productImage(row.product?.images)}
                      alt={name}
                      loading="lazy"
                      decoding="async"
                      className="h-24 w-20 object-cover sm:h-28 sm:w-24"
                      onError={(e) => {
                        e.currentTarget.src = PLACEHOLDER;
                      }}
                    />
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {row.pending ? (
                          <div className="space-y-1" aria-hidden>
                            <div className="h-3.5 w-32 animate-pulse rounded bg-line/60" />
                            <div className="h-2.5 w-20 animate-pulse rounded bg-line/40" />
                          </div>
                        ) : row.missing ? (
                          <p className="text-sm font-semibold text-ink">{L(lang, "منتج غير متوفر", "Product unavailable")}</p>
                        ) : (
                          <Link
                            href={`/product/${row.product?.slug}`}
                            className="line-clamp-2 text-sm font-semibold text-ink hover:text-primary"
                          >
                            {name}
                          </Link>
                        )}
                        {row.variant && (
                          <p className="mt-1 text-xs text-muted">
                            {L(lang, row.variant.label, row.variant.labelEn || row.variant.label)}
                          </p>
                        )}
                        {Object.entries(row.line.options || {}).length > 0 && (
                          <p className="mt-1 text-xs text-muted">
                            {Object.entries(row.line.options)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(row.key)}
                        className="shrink-0 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        {t("remove")}
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <QtyStepper
                        value={row.line.qty}
                        onChange={(q) => setQty(row.key, q)}
                        min={1}
                        max={99}
                      />
                      <span className="text-sm font-bold text-ink">
                        {formatMoney(row.total, settings)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}

            {error && (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            <div className="pt-2">
              <Link href="/products" className="btn btn-ghost min-h-11">
                {t("continueShopping")}
              </Link>
            </div>
          </div>

          {/* الملخص */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card-lux space-y-4 p-5">
              <h2 className="text-base font-bold text-ink">{t("orderSummary")}</h2>

              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("subtotal")}</dt>
                  <dd className="font-semibold text-ink">{formatMoney(totals.subtotal, settings)}</dd>
                </div>
                {totals.discount > 0 && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">{t("discount")}</dt>
                    <dd className="font-semibold text-emerald-700">-{formatMoney(totals.discount, settings)}</dd>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-muted">{t("shipping")}</dt>
                  <dd className="font-semibold text-ink">
                    {totals.shipping > 0 ? formatMoney(totals.shipping, settings) : t("free")}
                  </dd>
                </div>
                {settings?.taxEnabled && (
                  <div className="flex items-center justify-between">
                    <dt className="text-muted">{t("tax")}</dt>
                    <dd className="font-semibold text-ink">{formatMoney(totals.tax, settings)}</dd>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
                  <dt className="font-bold text-ink">{t("total")}</dt>
                  <dd className="text-lg font-bold text-primary">{formatMoney(totals.total, settings)}</dd>
                </div>
              </dl>

              {belowFreeShipping && (
                <p className="rounded-xl bg-cream px-3 py-2 text-xs text-ink">
                  {t("freeShippingNote")} — {L(lang, "أضف", "Add")}{" "}
                  <span className="font-bold">{formatMoney(remainingForFree, settings)}</span>{" "}
                  {L(lang, "للحصول على شحن مجاني", "to unlock free shipping")}
                </p>
              )}

              {belowMinOrder && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {t("minOrderNote")}: {formatMoney(minOrder, settings)}
                </p>
              )}

              {!ordersEnabled && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {t("ordersPaused")}
                </p>
              )}

              {loading && (
                <p className="text-xs text-muted">{t("loading")}</p>
              )}

              {canCheckout ? (
                <Link href="/checkout" className="btn btn-gold min-h-12 w-full">
                  {t("proceedToCheckout")}
                </Link>
              ) : (
                <button type="button" disabled className="btn btn-gold min-h-12 w-full">
                  {t("proceedToCheckout")}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
