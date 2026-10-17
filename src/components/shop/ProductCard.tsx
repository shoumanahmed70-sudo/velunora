"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/lib/i18n/provider";
import { useCart } from "@/lib/cart-provider";
import { useToast } from "@/lib/toast";
import type { Product } from "@/lib/types";
import { Price } from "@/components/shop/Price";
import { CheckIcon, PlusIcon } from "@/components/shop/icons";
import { useTilt } from "@/components/shop/fx";
import {
  L,
  availableVariant,
  displayVariant,
  hasStock,
  localizedName,
  productImage,
  PLACEHOLDER,
} from "@/components/shop/utils";

/** بطاقة منتج: صورة، اسم، الحجم الأصغر، السعر، شارات، وإضافة سريعة. */
export function ProductCard({ product }: { product: Product }) {
  const { lang } = useLang();
  const t = useT();
  const { add } = useCart();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const tilt = useTilt<HTMLElement>(9);

  const name = localizedName(product, lang);
  const dv = displayVariant(product);
  const price = dv ? dv.price : product.price;
  const compareAt = dv ? (dv.compareAtPrice ?? null) : product.compareAtPrice;
  const discountPct = compareAt && compareAt > price ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const available = hasStock(product);
  const variant = availableVariant(product);

  function quickAdd() {
    if (!available) return;
    add({ productId: product.id, variantId: variant ? variant.id : null, options: {}, qty: 1 });
    toast(t("addedToCart"), "success");
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  }

  return (
    <article
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="tilt card-3d group relative flex h-full flex-col overflow-hidden"
    >
      <Link href={`/product/${product.slug}`} className="absolute inset-0 z-10" aria-label={name}>
        <span className="sr-only">{name}</span>
      </Link>

      <div className="relative aspect-[3/4] overflow-hidden bg-cream">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={productImage(product.images)}
          alt={name}
          loading="lazy"
          decoding="async"
          className="tilt-media h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
        <div className="absolute start-3 top-3 z-20 flex flex-col items-start gap-1 tilt-pop">
          {product.isNew && (
            <span className="chip bg-primary text-white">{L(lang, "جديد", "New")}</span>
          )}
          {discountPct > 0 && (
            <span className="chip bg-gold text-primary">{L(lang, `خصم ${discountPct}%`, `${discountPct}% off`)}</span>
          )}
        </div>
        {!available && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-white/65">
            <span className="chip bg-ink text-white">{t("outOfStockLabel")}</span>
          </div>
        )}
        <span className="glare" aria-hidden />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-ink">{name}</h3>
        {dv && (
          <span className="text-xs text-muted">{L(lang, dv.label, dv.labelEn || dv.label)}</span>
        )}
        <div className="relative z-20 mt-auto flex items-center justify-between gap-2 pt-2">
          <Price value={price} compareAt={compareAt} size="md" />
          <button
            type="button"
            onClick={quickAdd}
            disabled={!available}
            aria-label={t("addToCart")}
            title={t("addToCart")}
            className="btn btn-gold min-h-11 w-11 shrink-0"
            style={{ paddingInline: 0 }}
          >
            {added ? <CheckIcon size={18} /> : <PlusIcon size={18} />}
          </button>
        </div>
      </div>
    </article>
  );
}
