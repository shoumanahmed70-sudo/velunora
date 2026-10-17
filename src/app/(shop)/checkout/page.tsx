"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart-provider";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { useApi, errorMessage } from "@/lib/api-client";
import { digitsOnly, formatMoney, normalizeDigits } from "@/lib/money";
import type { OrderCustomer, PublicOrder } from "@/lib/types";
import { writeLastOrder } from "@/lib/local-store";
import { useStoreSafe } from "@/components/shop/hooks";
import { useCartDetails } from "@/components/shop/useCartDetails";
import { EmptyState } from "@/components/shop/EmptyState";
import { L, PLACEHOLDER, localizedName, productImage } from "@/components/shop/utils";

interface CreateOrderResponse {
  order: PublicOrder;
  waUrl: string;
  waMessage: string;
}

type FieldErrors = Partial<Record<"name" | "phone" | "city" | "address", string>>;

function makeIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch {
    /* تجاهل */
  }
  return `vn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function CheckoutPage() {
  const { lang } = useLang();
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { lines, clear, ready } = useCart();
  const { me } = useMe();
  const { settings } = useStoreSafe();
  const { rows, totals, loading: totalsLoading } = useCartDetails();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submittingRef = useRef(false);
  const idempotencyRef = useRef<string>("");

  useEffect(() => {
    if (!idempotencyRef.current) idempotencyRef.current = makeIdempotencyKey();
  }, []);

  // تعبئة مسبقة من الحساب
  useEffect(() => {
    const user = me?.user;
    if (!user) return;
    setName((v) => v || user.name || "");
    setPhone((v) => v || user.phone || "");
    setCity((v) => v || user.city || "");
    setAddress((v) => v || user.address || "");
  }, [me]);

  const ordersEnabled = settings ? settings.ordersEnabled : true;
  const minOrder = settings?.minOrder ?? 0;
  const belowMinOrder = minOrder > 0 && totals.net < minOrder;
  const canSubmit = lines.length > 0 && ordersEnabled && !belowMinOrder && !submitting;

  function validate(): boolean {
    const next: FieldErrors = {};
    if (!name.trim()) next.name = t("requiredField");
    const cleanedPhone = digitsOnly(normalizeDigits(phone.trim()));
    if (!cleanedPhone) next.phone = t("requiredField");
    else if (cleanedPhone.replace(/\D/g, "").length < 8) next.phone = t("invalidPhone");
    if (!city.trim()) next.city = t("requiredField");
    if (!address.trim()) next.address = t("requiredField");
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submittingRef.current) return;
    setError("");
    if (!validate()) return;

    submittingRef.current = true;
    setSubmitting(true);

    // نفتح تبويب واتساب مسبقًا داخل نقرة المستخدم نفسها.
    // السبب: المتصفح يحجب النوافذ التي تُفتح بعد `await` (انتهاء صلاحية تفعيل المستخدم)،
    // فنحجز التبويب الآن ونوجّهه إلى واتساب بعد نجاح الطلب. وإن فشل الطلب نُغلقه.
    let waTab: Window | null = null;
    try {
      waTab = window.open("about:blank", "_blank");
    } catch {
      waTab = null;
    }

    const customer: OrderCustomer = {
      name: name.trim(),
      phone: normalizeDigits(phone.trim()),
      city: city.trim(),
      address: address.trim(),
      notes: notes.trim(),
      email: me?.user?.email ?? null,
    };

    try {
      const res = await api.post<CreateOrderResponse>("/api/orders", {
        items: lines,
        customer,
        idempotencyKey: idempotencyRef.current,
      });

      // آخر طلب يُحفظ بمفتاح صاحب الحساب — فلا يظهر لعميل آخر على نفس الجهاز
      writeLastOrder(me?.user?.uid ?? null, {
        number: res.order.number,
        phone: customer.phone,
        waUrl: res.waUrl,
        waMessage: res.waMessage,
      });

      clear();

      // تفريغ سلة الخادم فورًا (الخادم يفرّغها أيضًا عند إنشاء الطلب)
      if (me?.user?.uid) {
        api.put("/api/account/cart", { lines: [] }).catch(() => undefined);
      }

      // الانتقال المباشر إلى واتساب برسالة الطلب جاهزة (العميل يضغط «إرسال» فقط)
      if (res.waUrl) {
        if (waTab) {
          try {
            waTab.location.replace(res.waUrl);
          } catch {
            /* تجاهل: نبقى على صفحة التأكيد بزر واتساب */
          }
        } else {
          // حُجبت النافذة المنبثقة — نحاول مرة أخرى؛ وصفحة التأكيد فيها الزر كبديل
          try {
            window.open(res.waUrl, "_blank", "noopener,noreferrer");
          } catch {
            /* تجاهل */
          }
        }
      } else if (waTab) {
        try {
          waTab.close();
        } catch {
          /* تجاهل */
        }
      }

      toast(t("orderSuccessTitle"), "success");
      router.push("/order/confirmation");
    } catch (err) {
      // لم يُنشأ الطلب — نُغلق تبويب واتساب الذي حجزناه
      if (waTab) {
        try {
          waTab.close();
        } catch {
          /* تجاهل */
        }
      }
      setError(errorMessage(err, t("errGeneric")));
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (ready && lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title={t("cartEmpty")}
          hint={t("cartEmptyCta")}
          action={
            <Link href="/products" className="btn btn-primary min-h-11">
              {t("continueShopping")}
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("checkoutTitle")}</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* النموذج */}
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="card-lux space-y-5 p-5 sm:p-6">
            <h2 className="text-base font-bold text-ink">{t("contactInfo")}</h2>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <label className="field-label" htmlFor="ck-name">
                  {t("fullName")} <span className="text-red-600">*</span>
                </label>
                <input
                  id="ck-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="field"
                  autoComplete="name"
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name && <p className="mt-1 text-xs text-red-700">{errors.name}</p>}
              </div>

              <div className="sm:col-span-1">
                <label className="field-label" htmlFor="ck-phone">
                  {t("phone")} <span className="text-red-600">*</span>
                </label>
                <input
                  id="ck-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field text-start"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={Boolean(errors.phone)}
                />
                {errors.phone && <p className="mt-1 text-xs text-red-700">{errors.phone}</p>}
              </div>

              <div className="sm:col-span-1">
                <label className="field-label" htmlFor="ck-city">
                  {t("city")} <span className="text-red-600">*</span>
                </label>
                <input
                  id="ck-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="field"
                  autoComplete="address-level2"
                  aria-invalid={Boolean(errors.city)}
                />
                {errors.city && <p className="mt-1 text-xs text-red-700">{errors.city}</p>}
              </div>

              <div className="sm:col-span-1">
                <label className="field-label" htmlFor="ck-address">
                  {t("address")} <span className="text-red-600">*</span>
                </label>
                <input
                  id="ck-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="field"
                  autoComplete="street-address"
                  aria-invalid={Boolean(errors.address)}
                />
                {errors.address && <p className="mt-1 text-xs text-red-700">{errors.address}</p>}
              </div>

              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="ck-notes">
                  {t("deliveryNotes")} <span className="text-muted">({t("optional")})</span>
                </label>
                <textarea
                  id="ck-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="field"
                  maxLength={500}
                />
              </div>
            </div>

            {!me?.user && (
              <p className="rounded-xl bg-cream px-3 py-2 text-xs text-ink">
                <Link href="/auth/login?next=/checkout" className="font-semibold text-primary underline">
                  {t("login")}
                </Link>{" "}
                — {t("loginSuggest")}
              </p>
            )}
          </div>

          <div className="card-lux space-y-4 p-5 sm:p-6">
            <h2 className="text-base font-bold text-ink">{t("orderSummary")}</h2>

            <ul className="divide-y divide-line">
              {rows.map((row) => (
                <li key={row.key} className="flex items-center gap-3 py-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage(row.product?.images)}
                    alt={row.product ? localizedName(row.product, lang) : ""}
                    loading="lazy"
                    decoding="async"
                    className="h-14 w-12 shrink-0 rounded-lg border border-line object-cover"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    {row.pending ? (
                      <div className="h-3.5 w-32 animate-pulse rounded bg-line/60" aria-hidden />
                    ) : (
                      <p className="line-clamp-1 text-sm font-semibold text-ink">
                        {row.missing
                          ? L(lang, "منتج غير متوفر", "Product unavailable")
                          : localizedName(row.product!, lang)}
                      </p>
                    )}
                    <p className="text-xs text-muted">
                      {row.variant ? L(lang, row.variant.label, row.variant.labelEn || row.variant.label) : ""}
                      <span className="mx-1">×</span>
                      {row.line.qty}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatMoney(row.total, settings)}</span>
                </li>
              ))}
            </ul>

            <dl className="space-y-2 border-t border-line pt-4 text-sm">
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
              <div className="flex items-center justify-between border-t border-line pt-3">
                <dt className="font-bold text-ink">{t("total")}</dt>
                <dd className="text-lg font-bold text-primary">{formatMoney(totals.total, settings)}</dd>
              </div>
            </dl>

            <p className="rounded-xl bg-cream px-3 py-2 text-xs text-muted">
              {L(
                lang,
                "هذا الإجمالي تقديري للعرض فقط؛ يُحسب الإجمالي النهائي (بما فيه الشحن والضريبة) على الخادم عند تأكيد الطلب.",
                "This total is an estimate for display only; the final total (shipping and tax included) is calculated on the server when you confirm."
              )}
            </p>

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

            {error && (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            {totalsLoading && <p className="text-xs text-muted">{t("loading")}</p>}

            <button type="submit" disabled={!canSubmit} className="btn btn-gold min-h-12 w-full">
              {submitting ? t("sending") : t("confirmOrder")}
            </button>

            <Link href="/cart" className="btn btn-ghost min-h-11 w-full">
              {t("back")}
            </Link>
          </div>
        </form>

        {/* عمود مساعد على الشاشات الكبيرة */}
        <aside className="hidden lg:block">
          <div className="card-lux space-y-3 p-5">
            <h3 className="text-sm font-bold text-ink">{t("contactInfo")}</h3>
            <p className="text-xs leading-relaxed text-muted">
              {L(
                lang,
                "بعد التأكيد سيظهر لك رقم الطلب مع زر واتساب لإرسال ملخص الطلب إلى المتجر.",
                "After confirming, you'll get the order number with a WhatsApp button to send the order summary to the store."
              )}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
