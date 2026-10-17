"use client";

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n/provider";
import { Reveal } from "@/components/shop/fx";

interface SectionHeadingProps {
  titleAr: string;
  titleEn?: string;
  href?: string;
  actionLabel?: string;
}

/** عنوان قسم فاخر مع زر «عرض الكل» اختياري وخط ذهبي ينمو عند الظهور. */
export function SectionHeading({ titleAr, titleEn = "", href, actionLabel }: SectionHeadingProps) {
  const { lang } = useLang();
  const t = useT();
  const title = lang === "en" && titleEn ? titleEn : titleAr;

  return (
    <Reveal className="mb-6 sm:mb-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="display truncate text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
          <span className="rule-track mt-3">
            <span />
          </span>
        </div>
        {href && (
          <Link
            href={href}
            className="group inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-gold transition-colors hover:text-primary"
          >
            {actionLabel || t("viewAll")}
            <span aria-hidden className="transition-transform duration-300 group-hover:-translate-x-1 rtl:group-hover:translate-x-1">
              {lang === "en" ? "→" : "←"}
            </span>
          </Link>
        )}
      </div>
    </Reveal>
  );
}

