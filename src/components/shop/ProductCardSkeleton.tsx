/** هيكل تحميل لبطاقة منتج. */
export function ProductCardSkeleton() {
  return (
    <div className="card-lux overflow-hidden">
      <div className="aspect-[3/4] w-full animate-pulse bg-cream" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 animate-pulse rounded bg-cream" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-cream" />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="h-5 w-20 animate-pulse rounded bg-cream" />
          <div className="h-9 w-9 animate-pulse rounded-full bg-cream" />
        </div>
      </div>
    </div>
  );
}
