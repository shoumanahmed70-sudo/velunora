"use client";

import { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "@/lib/api-client";
import { lineKey, useCart } from "@/lib/cart-provider";
import type { CartLine, Product, ProductVariant, StoreSettings } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { estimateTotals, type EstimateTotals } from "@/components/shop/utils";

export interface CartRow {
  key: string;
  line: CartLine;
  product: Product | null;
  variant: ProductVariant | null;
  unitPrice: number;
  compareAt: number | null;
  total: number;
  /** لم تُحمَّل تفاصيل المنتج بعد (لا تُظهر «غير متوفر» أثناء التحميل). */
  pending: boolean;
  /** اكتمل التحميل والمنتج غير موجود فعلًا (محذوف/مخفي). */
  missing: boolean;
}

export interface CartDetails {
  rows: CartRow[];
  totals: EstimateTotals;
  loading: boolean;
  error: string;
  settings: StoreSettings | null;
}

/**
 * يجلب تفاصيل المنتجات لأسطر السلة عبر /api/products/[id] (Promise.all).
 * الأسعار هنا للعرض فقط؛ الخادم هو المرجع عند التأكيد.
 */
export function useCartDetails(): CartDetails {
  const { lines } = useCart();
  const { settings } = useStoreSafe();
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const productIds = useMemo(
    () => Array.from(new Set(lines.map((l) => l.productId))).sort(),
    [lines]
  );
  const idsKey = productIds.join(",");

  useEffect(() => {
    const missing = productIds.filter((id) => !products[id]);
    if (!missing.length) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    (async () => {
      try {
        const results = await Promise.all(
          missing.map(async (id) => {
            try {
              const res = await api.get<{ product: Product }>(`/api/products/${encodeURIComponent(id)}`);
              return res.product;
            } catch {
              return null;
            }
          })
        );
        if (cancelled) return;
        setProducts((prev) => {
          const next = { ...prev };
          for (const p of results) if (p) next[p.id] = p;
          return next;
        });
      } catch (err) {
        if (!cancelled) setError(errorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const rows: CartRow[] = lines.map((line) => {
    const product = products[line.productId] ?? null;
    const variant = product ? (product.variants || []).find((v) => v.id === line.variantId) ?? null : null;
    const unitPrice = variant ? variant.price : product?.price ?? 0;
    const compareAt = variant ? (variant.compareAtPrice ?? null) : product?.compareAtPrice ?? null;
    const pending = !product && loading;
    return {
      key: lineKey(line),
      line,
      product,
      variant,
      unitPrice,
      compareAt,
      total: unitPrice * line.qty,
      pending,
      missing: !product && !loading,
    };
  });

  const totals = estimateTotals(
    rows.map((r) => ({ unitPrice: r.unitPrice, compareAt: r.compareAt, qty: r.line.qty })),
    settings
  );

  return { rows, totals, loading, error, settings };
}
