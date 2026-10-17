"use client";

import { formatMoney } from "@/lib/money";
import { useStoreSafe } from "@/components/shop/hooks";

interface PriceProps {
  value: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES: Record<NonNullable<PriceProps["size"]>, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-2xl",
};

/** عرض السعر الحالي مع السعر قبل الخصم مشطوبًا إن وُجد. */
export function Price({ value, compareAt = null, size = "md", className = "" }: PriceProps) {
  const { settings } = useStoreSafe();
  const onSale = typeof compareAt === "number" && compareAt > value;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${className}`}>
      <span className={`font-bold text-primary ${SIZES[size]}`}>{formatMoney(value, settings)}</span>
      {onSale && (
        <s className="text-xs text-muted line-through">{formatMoney(compareAt as number, settings)}</s>
      )}
    </span>
  );
}
