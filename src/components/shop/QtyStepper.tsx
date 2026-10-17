"use client";

import { MinusIcon, PlusIcon } from "@/components/shop/icons";

interface QtyStepperProps {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}

/** محدّد كمية بأزرار لمس مريحة على الجوال. */
export function QtyStepper({ value, onChange, min = 1, max = 99, disabled = false }: QtyStepperProps) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  return (
    <div className="inline-flex items-center overflow-hidden rounded-full border border-line bg-white">
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        disabled={disabled || value <= min}
        aria-label="-"
        className="grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-cream disabled:opacity-40"
      >
        <MinusIcon size={16} />
      </button>
      <span className="min-w-10 px-2 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        disabled={disabled || value >= max}
        aria-label="+"
        className="grid h-11 w-11 place-items-center text-ink transition-colors hover:bg-cream disabled:opacity-40"
      >
        <PlusIcon size={16} />
      </button>
    </div>
  );
}
