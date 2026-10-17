"use client";

import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/shop/ProductCard";
import { ProductCardSkeleton } from "@/components/shop/ProductCardSkeleton";
import { Reveal } from "@/components/shop/fx";

interface ProductGridProps {
  products: Product[];
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}

const GRID = "grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4";

/** شبكة منتجات متجاوبة مع حالات تحميل وفراغ. */
export function ProductGrid({ products, loading = false, skeletonCount = 8, className = "" }: ProductGridProps) {
  if (loading) {
    return (
      <div className={`${GRID} ${className}`}>
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!products.length) return null;

  return (
    <div className={`${GRID} ${className}`}>
      {products.map((p, index) => (
        <Reveal key={p.id} delay={(index % 4) * 80} className="h-full">
          <ProductCard product={p} />
        </Reveal>
      ))}
    </div>
  );
}
