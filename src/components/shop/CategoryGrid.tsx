"use client";

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n/provider";
import type { Category } from "@/lib/types";
import { Tilt } from "@/components/shop/fx";
import { L } from "@/components/shop/utils";

/** شبكة أقسام أنيقة مع عمق ثلاثي الأبعاد (بدون صور خارجية). */
export function CategoryGrid({ categories }: { categories: Category[] }) {
  const { lang } = useLang();
  const t = useT();

  if (!categories.length) return null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((c) => {
        const name = L(lang, c.name, c.nameEn);
        return (
          <Tilt key={c.id} max={9} className="card-3d h-full overflow-hidden">
            <Link
              href={`/products?category=${encodeURIComponent(c.slug)}`}
              className="group relative flex h-full flex-col items-center gap-3 p-6 text-center"
            >
              <span className="tilt-pop grid h-16 w-16 place-items-center rounded-full bg-cream text-gold shadow-inner transition-colors duration-300 group-hover:bg-primary group-hover:text-gold-soft">
                <span className="display text-2xl">{name.trim().charAt(0)}</span>
              </span>
              <span className="text-sm font-semibold text-ink">{name}</span>
              <span className="text-xs text-muted">{t("viewAll")}</span>
              <span className="glare" aria-hidden />
            </Link>
          </Tilt>
        );
      })}
    </div>
  );
}
