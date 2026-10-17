"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang, useT } from "@/lib/i18n/provider";
import { useApi, errorMessage } from "@/lib/api-client";
import type { Category, Product } from "@/lib/types";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { EmptyState } from "@/components/shop/EmptyState";
import { L } from "@/components/shop/utils";

export interface ProductFilters {
  q: string;
  category: string;
  tag: string;
  sort: string;
}

interface ProductsExplorerProps {
  initial: Product[];
  nextCursor: string | null;
  categories: Category[];
  filters: ProductFilters;
}

const SORT_OPTIONS = [
  { value: "newest", key: "sortNewest" },
  { value: "price_asc", key: "sortPriceAsc" },
  { value: "price_desc", key: "sortPriceDesc" },
  { value: "featured", key: "sortFeatured" },
] as const;

function buildQuery(filters: ProductFilters, cursor?: string): string {
  const p = new URLSearchParams();
  if (filters.q) p.set("q", filters.q);
  if (filters.category) p.set("category", filters.category);
  if (filters.tag) p.set("tag", filters.tag);
  if (filters.sort && filters.sort !== "newest") p.set("sort", filters.sort);
  if (cursor) p.set("cursor", cursor);
  return p.toString();
}

export function ProductsExplorer({ initial, nextCursor, categories, filters }: ProductsExplorerProps) {
  const { lang } = useLang();
  const t = useT();
  const api = useApi();
  const router = useRouter();

  const [items, setItems] = useState<Product[]>(initial);
  const [cursor, setCursor] = useState<string | null>(nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setItems(initial);
    setCursor(nextCursor);
    setError("");
  }, [initial, nextCursor]);

  function href(overrides: Partial<ProductFilters>): string {
    const merged = { ...filters, ...overrides };
    const qs = buildQuery(merged);
    return qs ? `/products?${qs}` : "/products";
  }

  async function loadMore() {
    if (!cursor || loading) return;
    setLoading(true);
    setError("");
    try {
      const qs = buildQuery(filters, cursor);
      const res = await api.get<{ items: Product[]; nextCursor: string | null }>(`/api/products?${qs}`);
      setItems((prev) => [...prev, ...(res.items || [])]);
      setCursor(res.nextCursor ?? null);
    } catch (err) {
      setError(errorMessage(err, t("errGeneric")));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display text-3xl font-semibold text-ink sm:text-4xl">{t("productsTitle")}</h1>
          <p className="mt-2 text-sm text-muted">
            {items.length} {t("resultsCount")}
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="whitespace-nowrap text-muted">{t("search")}</span>
          <div className="w-40 sm:w-44">
            <select
              value={filters.sort || "newest"}
              onChange={(e) => router.push(href({ sort: e.target.value }))}
              className="field min-h-11"
              style={{ paddingBlock: "0.5rem" }}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {/* شريط الفلترة */}
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={href({ category: "" })}
          className={`chip min-h-9 border ${
            filters.category ? "border-line bg-white text-ink" : "border-primary bg-primary text-white"
          }`}
        >
          {t("all")}
        </Link>
        {categories.map((c) => {
          const active = filters.category === c.slug;
          return (
            <Link
              key={c.id}
              href={href({ category: c.slug })}
              className={`chip min-h-9 border ${
                active ? "border-primary bg-primary text-white" : "border-line bg-white text-ink"
              }`}
            >
              {L(lang, c.name, c.nameEn)}
            </Link>
          );
        })}
      </div>

      {filters.q && (
        <p className="mt-4 text-sm text-muted">
          {L(lang, "نتائج البحث عن:", "Search results for:")}{" "}
          <span className="font-semibold text-ink">«{filters.q}»</span>
        </p>
      )}

      <div className="mt-8">
        {items.length === 0 ? (
          <EmptyState
            title={t("noResults")}
            hint={t("noResultsHint")}
            action={
              <Link href="/products" className="btn btn-outline min-h-11">
                {t("clear")}
              </Link>
            }
          />
        ) : (
          <ProductGrid products={items} />
        )}
      </div>

      {error && (
        <p className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {cursor && items.length > 0 && (
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="btn btn-outline min-h-11"
          >
            {loading ? t("loading") : L(lang, "تحميل المزيد", "Load more")}
          </button>
        </div>
      )}
    </div>
  );
}
