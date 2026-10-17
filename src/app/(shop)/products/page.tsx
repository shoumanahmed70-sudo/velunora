import type { Metadata } from "next";
import { getCategories, listProducts } from "@/lib/server/catalog";
import { ProductsExplorer, type ProductFilters } from "@/components/shop/ProductsExplorer";

export const metadata: Metadata = {
  title: "العطور",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const SORTS = ["newest", "price_asc", "price_desc", "featured"] as const;

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  const q = first(sp.q).trim();
  const category = first(sp.category).trim();
  const rawTag = first(sp.tag).trim();
  const tag = rawTag === "new" || rawTag === "sale" ? rawTag : "";
  const rawSort = first(sp.sort).trim();
  const sort = (SORTS as readonly string[]).includes(rawSort) ? rawSort : "newest";

  const filters: ProductFilters = { q, category, tag, sort };

  const [{ items, nextCursor }, categories] = await Promise.all([
    listProducts({
      q: q || undefined,
      category: category || undefined,
      tag: tag === "new" || tag === "sale" ? tag : undefined,
      sort: sort as (typeof SORTS)[number],
      limit: 24,
    }),
    getCategories(),
  ]);

  const activeCategories = categories.filter((c) => c.active).sort((a, b) => a.order - b.order);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <ProductsExplorer
        initial={items}
        nextCursor={nextCursor}
        categories={activeCategories}
        filters={filters}
      />
    </div>
  );
}
