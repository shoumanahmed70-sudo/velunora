"use client";

import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  hint?: string;
  icon?: ReactNode;
  action?: ReactNode;
}

/** حالة فراغ أنيقة قابلة لإعادة الاستخدام. */
export function EmptyState({ title, hint, icon, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-line bg-white/60 px-6 py-16 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-cream text-gold">
        {icon ?? <span className="display text-2xl">V</span>}
      </div>
      <h3 className="text-lg font-semibold text-ink">{title}</h3>
      {hint && <p className="max-w-md text-sm text-muted">{hint}</p>}
      {action && <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{action}</div>}
    </div>
  );
}
