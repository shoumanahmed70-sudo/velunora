"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart-provider";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { useApi, errorMessage } from "@/lib/api-client";
import type { Product, Review } from "@/lib/types";
import { Price } from "@/components/shop/Price";
import { QtyStepper } from "@/components/shop/QtyStepper";
import { RatingStars } from "@/components/shop/RatingStars";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { L, PLACEHOLDER, localizedDescription, localizedName, productImage } from "@/components/shop/utils";
import { StarIcon } from "@/components/shop/icons";
import { useStoreSafe } from "@/components/shop/hooks";

interface ProductViewProps {
  product: Product;
  reviews: Review[];
  related: Product[];
}

function formatDate(ts: number, lang: "ar" | "en"): string {
  try {
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

export function ProductView({ product, reviews: initialReviews, related }: ProductViewProps) {
  const { lang } = useLang();
  const t = useT();
  const router = useRouter();
  const api = useApi();
  const toast = useToast();
  const { add } = useCart();
  const { me } = useMe();
  const { settings } = useStoreSafe();

  const name = localizedName(product, lang);
  const description = localizedDescription(product, lang);
  const variants = product.variants || [];

  const [imageIndex, setImageIndex] = useState(0);
  const [variantId, setVariantId] = useState<string | null>(
    variants.find((v) => v.stock > 0)?.id ?? variants[0]?.id ?? null
  );
  const [options, setOptions] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of product.options || []) {
      if (opt.values?.length) initial[opt.label] = opt.values[0];
    }
    return initial;
  });
  const [qty, setQty] = useState(1);

  const [reviews, setReviews] = useState<Review[]>(initialReviews || []);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const variant = useMemo(() => variants.find((v) => v.id === variantId) ?? null, [variants, variantId]);
  const price = variant ? variant.price : product.price;
  const compareAt = variant ? (variant.compareAtPrice ?? null) : product.compareAtPrice;
  const stock = variant ? variant.stock : product.stock;
  const available = stock > 0;
  const saving = compareAt && compareAt > price ? compareAt - price : 0;

  const images = product.images?.length ? product.images : [PLACEHOLDER];
  const mainImage = images[Math.min(imageIndex, images.length - 1)] || PLACEHOLDER;

  const avgRating = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;

  const reviewsEnabled = Boolean(settings?.reviewsEnabled);
  const loggedIn = Boolean(me?.user);

  function handleAdd(): boolean {
    if (!available) return false;
    add({ productId: product.id, variantId: variant?.id ?? null, options, qty });
    return true;
  }

  function onAddToCart() {
    if (handleAdd()) toast(t("addedToCart"), "success");
  }

  function onBuyNow() {
    if (handleAdd()) router.push("/checkout");
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    setReviewError("");
    setSending(true);
    try {
      const res = await api.post<{ review: Review }>("/api/reviews", {
        productId: product.id,
        rating,
        comment: comment.trim(),
      });
      setReviews((prev) => [res.review, ...prev]);
      setComment("");
      setRating(5);
      toast(t("saved"), "success");
    } catch (err) {
      setReviewError(errorMessage(err, t("errGeneric")));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav className="mb-6 flex flex-wrap items-center gap-2 text-xs text-muted" aria-label="breadcrumb">
        <Link href="/" className="hover:text-primary">
          {t("home")}
        </Link>
        <span>/</span>
        <Link href="/products" className="hover:text-primary">
          {t("productsNav")}
        </Link>
        <span>/</span>
        <span className="text-ink">{name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        {/* المعرض */}
        <div>
          <div className="card-lux overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImage([mainImage])}
              alt={name}
              loading="eager"
              decoding="async"
              className="aspect-[4/5] w-full object-cover"
              onError={(e) => {
                e.currentTarget.src = PLACEHOLDER;
              }}
            />
          </div>
          {images.length > 1 && (
            <div className="mt-4 grid grid-cols-4 gap-3 sm:grid-cols-5">
              {images.map((img, i) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  onClick={() => setImageIndex(i)}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    i === imageIndex ? "border-gold" : "border-line hover:border-gold/60"
                  }`}
                  aria-label={`${i + 1}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={productImage([img])}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="aspect-square w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.src = PLACEHOLDER;
                    }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            {product.isNew && <span className="chip bg-primary text-white">{L(lang, "جديد", "New")}</span>}
            {saving > 0 && (
              <span className="chip bg-gold text-primary">
                {L(lang, "عرض خاص", "Special offer")}
              </span>
            )}
          </div>

          <h1 className="display mt-3 text-3xl font-semibold text-ink sm:text-4xl">{name}</h1>

          {reviews.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <RatingStars value={avgRating} showValue />
              <span className="text-xs text-muted">
                ({reviews.length} {t("reviews")})
              </span>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Price value={price} compareAt={compareAt} size="lg" />
            {saving > 0 && (
              <span className="chip bg-cream text-primary">
                {t("youSave")} {new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(saving)}{" "}
                {settings?.currencySymbol || ""}
              </span>
            )}
          </div>

          {/* التوفر */}
          <p className="mt-4 text-sm">
            {available ? (
              stock <= 5 ? (
                <span className="chip bg-amber-100 text-amber-800">{t("lowStock")}</span>
              ) : (
                <span className="chip bg-emerald-100 text-emerald-800">{t("inStock")}</span>
              )
            ) : (
              <span className="chip bg-red-100 text-red-700">{t("outOfStockLabel")}</span>
            )}
          </p>

          {description && (
            <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-muted">{description}</p>
          )}

          {/* الأحجام */}
          {variants.length > 0 && (
            <div className="mt-6">
              <span className="field-label">{t("selectVolume")}</span>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = v.id === variantId;
                  const disabled = v.stock <= 0;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setVariantId(v.id)}
                      disabled={disabled}
                      className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors ${
                        active
                          ? "border-primary bg-primary text-white"
                          : "border-line bg-white text-ink hover:border-gold"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      {L(lang, v.label, v.labelEn || v.label)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* الخيارات */}
          {(product.options || []).map((opt) => (
            <div key={opt.label} className="mt-6">
              <span className="field-label">{L(lang, opt.label, opt.labelEn || opt.label)}</span>
              <div className="flex flex-wrap gap-2">
                {opt.values.map((value) => {
                  const active = options[opt.label] === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setOptions((prev) => ({ ...prev, [opt.label]: value }))}
                      className={`min-h-11 rounded-full border px-4 text-sm transition-colors ${
                        active ? "border-gold bg-cream text-ink" : "border-line bg-white text-ink hover:border-gold/60"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* الكمية + الأزرار */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div>
              <span className="field-label">{t("qty")}</span>
              <QtyStepper value={qty} onChange={setQty} min={1} max={Math.max(1, Math.min(99, stock || 1))} disabled={!available} />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onAddToCart} disabled={!available} className="btn btn-outline min-h-12 flex-1">
              {t("addToCart")}
            </button>
            <button type="button" onClick={onBuyNow} disabled={!available} className="btn btn-gold min-h-12 flex-1">
              {t("buyNow")}
            </button>
          </div>
        </div>
      </div>

      {/* التقييمات */}
      <section className="mt-16">
        <SectionHeading titleAr={t("reviews")} />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {reviews.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-8 text-center text-sm text-muted">
                {t("noReviews")}
              </p>
            ) : (
              reviews.map((r) => (
                <article key={r.id} className="card-lux p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{r.authorName}</p>
                      <p className="text-xs text-muted">{formatDate(r.createdAt, lang)}</p>
                    </div>
                    <RatingStars value={r.rating} size={15} />
                  </div>
                  {r.comment && <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.comment}</p>}
                </article>
              ))
            )}
          </div>

          <div>
            {reviewsEnabled ? (
              loggedIn ? (
                <form onSubmit={submitReview} className="card-lux space-y-4 p-5">
                  <h3 className="text-base font-semibold text-ink">{t("writeReview")}</h3>
                  <div>
                    <span className="field-label">{t("reviews")}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          aria-label={`${n} / 5`}
                          className={n <= rating ? "text-gold" : "text-line"}
                        >
                          <StarIcon size={24} filled={n <= rating} />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="field-label" htmlFor="review-comment">
                      {t("description")}
                    </label>
                    <textarea
                      id="review-comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={4}
                      className="field"
                      maxLength={800}
                    />
                  </div>
                  {reviewError && <p className="text-sm text-red-700">{reviewError}</p>}
                  <button type="submit" disabled={sending} className="btn btn-primary min-h-11 w-full">
                    {sending ? t("sending") : t("writeReview")}
                  </button>
                </form>
              ) : (
                <div className="card-lux space-y-3 p-5 text-center">
                  <p className="text-sm text-muted">{t("reviewLoginRequired")}</p>
                  <Link
                    href={`/auth/login?next=/product/${product.slug}`}
                    className="btn btn-outline min-h-11 w-full"
                  >
                    {t("login")}
                  </Link>
                </div>
              )
            ) : null}
          </div>
        </div>
      </section>

      {/* منتجات مشابهة */}
      {related.length > 0 && (
        <section className="mt-16">
          <SectionHeading titleAr={t("related")} href={`/products?category=${encodeURIComponent(product.category)}`} />
          <ProductGrid products={related} />
        </section>
      )}
    </div>
  );
}
