"use client";

import Link from "next/link";
import { useLang } from "@/lib/i18n/provider";
import type { Category, Product } from "@/lib/types";
import { SectionHeading } from "@/components/shop/SectionHeading";
import { ProductGrid } from "@/components/shop/ProductGrid";
import { CategoryGrid } from "@/components/shop/CategoryGrid";
import { Reveal, useScrollParallax, useTilt } from "@/components/shop/fx";
import { L, PLACEHOLDER } from "@/components/shop/utils";

export type HomeSectionData =
  | {
      id: string;
      type: "categories";
      titleAr: string;
      titleEn: string;
      categories: Category[];
    }
  | {
      id: string;
      type: "products";
      titleAr: string;
      titleEn: string;
      href: string;
      products: Product[];
    }
  | {
      id: string;
      type: "banner";
      titleAr: string;
      titleEn: string;
      image: string;
      href: string;
      buttonAr: string;
      buttonEn: string;
    };

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Reveal>{children}</Reveal>
    </section>
  );
}

/** بانر بعمق ثلاثي الأبعاد: parallax عند التمرير + ميلان يتبع المؤشّر. */
function BannerSection({ data }: { data: Extract<HomeSectionData, { type: "banner" }> }) {
  const { lang } = useLang();
  const title = L(lang, data.titleAr, data.titleEn);
  const button = L(lang, data.buttonAr, data.buttonEn);
  const parallax = useScrollParallax<HTMLDivElement>(34);
  const tilt = useTilt<HTMLDivElement>(6);

  if (!data.image) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <Reveal>
        <div ref={parallax} className="perspective">
          <div
            ref={tilt.ref}
            onPointerMove={tilt.onPointerMove}
            onPointerLeave={tilt.onPointerLeave}
            className="tilt banner-3d"
          >
            <div className="banner-bg" aria-hidden>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.image}
                alt=""
                loading="lazy"
                decoding="async"
                className="photo-fade h-full w-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = PLACEHOLDER;
                }}
              />
            </div>

            <span
              className="orb start-[8%] top-[12%] h-48 w-48"
              aria-hidden
              style={{ background: "radial-gradient(circle, rgb(198 161 91 / 0.5), transparent 70%)" }}
            />

            <div className="hero-scrim" aria-hidden />
            <div className="banner-sheen" aria-hidden />

            <div className="relative z-10 flex min-h-64 flex-col items-start justify-center gap-4 p-8 sm:min-h-80 sm:p-12 lg:min-h-96">
              <span className="chip border border-gold/40 bg-white/10 text-gold-soft backdrop-blur">
                <span className="text-gold">✦</span>
                <span>{L(lang, "عرض مميّز", "Featured")}</span>
              </span>
              {title && (
                <h2 className="display max-w-lg text-2xl font-semibold text-white drop-shadow-sm sm:text-4xl">
                  {title}
                </h2>
              )}
              {button && (
                <Link href={data.href} className="btn btn-gold min-h-11 shadow-lg">
                  {button}
                </Link>
              )}
            </div>

            <span className="glare" aria-hidden />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

/** يعرض أقسام الصفحة الرئيسية بالترتيب (المفعّلة فقط). */
export function HomeSections({ sections }: { sections: HomeSectionData[] }) {
  if (!sections.length) return null;

  return (
    <div className="space-y-16 py-14 sm:space-y-24 sm:py-20">
      {sections.map((s) => {
        if (s.type === "categories") {
          return (
            <SectionShell key={s.id}>
              <SectionHeading titleAr={s.titleAr} titleEn={s.titleEn} href="/products" />
              <CategoryGrid categories={s.categories} />
            </SectionShell>
          );
        }
        if (s.type === "banner") {
          return <BannerSection key={s.id} data={s} />;
        }
        return (
          <SectionShell key={s.id}>
            <SectionHeading titleAr={s.titleAr} titleEn={s.titleEn} href={s.href} />
            <ProductGrid products={s.products} />
          </SectionShell>
        );
      })}
    </div>
  );
}
