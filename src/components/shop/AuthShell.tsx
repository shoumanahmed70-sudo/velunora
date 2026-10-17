"use client";

import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** حاوية أنيقة موحّدة لصفحات المصادقة. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <div className="card-lux p-6 sm:p-8">
        <div className="mb-6 text-center">
          <h1 className="display text-2xl font-semibold text-ink sm:text-3xl">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
