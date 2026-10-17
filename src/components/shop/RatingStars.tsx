"use client";

import { StarIcon } from "@/components/shop/icons";

interface RatingStarsProps {
  value: number;
  count?: number;
  showValue?: boolean;
  size?: number;
}

/** نجوم تقييم (SVG) تدعم القيم النصفية تقريبًا لأقرب نصف نجمة. */
export function RatingStars({ value, count, showValue = false, size = 16 }: RatingStarsProps) {
  const safe = Math.max(0, Math.min(5, Number(value) || 0));
  const rounded = Math.round(safe * 2) / 2;

  return (
    <span className="inline-flex items-center gap-1" aria-label={`${safe} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const full = rounded >= i;
        const half = !full && rounded >= i - 0.5;
        return (
          <span key={i} className="relative inline-block text-gold" style={{ width: size, height: size }}>
            <StarIcon size={size} className="absolute inset-0 text-line" filled />
            {(full || half) && (
              <span
                className="absolute inset-0 overflow-hidden text-gold"
                style={{ width: full ? size : size / 2 }}
              >
                <StarIcon size={size} filled />
              </span>
            )}
          </span>
        );
      })}
      {showValue && <span className="text-xs text-muted ms-1">{safe.toFixed(1)}</span>}
      {typeof count === "number" && <span className="text-xs text-muted">({count})</span>}
    </span>
  );
}
