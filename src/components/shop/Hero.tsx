"use client";

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n/provider";
import { useStore } from "@/lib/store-provider";
import type { HomeSettings } from "@/lib/types";
import { L, PLACEHOLDER } from "@/components/shop/utils";
import { useLayerParallax } from "@/components/shop/fx";

/**
 * قسم البطل: طبقات بعمق ثلاثي الأبعاد + parallax يتبع المؤشّر والتمرير.
 * كل التأثيرات CSS/transform فقط ولا تعتمد أي صورة خارجية.
 */
export function Hero({ home }: { home: HomeSettings | null }) {
  const { lang } = useLang();
  const t = useT();
  const store = useStore();
  const ref = useLayerParallax<HTMLElement>(46);

  const title = home ? L(lang, home.heroTitle, home.heroTitleEn) : t("productsTitle");
  const subtitle = home ? L(lang, home.heroSubtitle, home.heroSubtitleEn) : "";
  const ctaText = (home ? L(lang, home.heroButtonText, home.heroButtonTextEn) : "") || t("shopNow");
  const ctaHref = home?.heroButtonHref || "/products";
  const image = home?.heroImage || "/brand/hero.svg";

  const settings = store.ready ? store.settings : null;
  const storeName = settings
    ? L(lang, settings.storeName, settings.storeNameEn || settings.storeName)
    : "VELUNORA";
  const tagline = settings ? L(lang, settings.tagline, settings.taglineEn || settings.tagline) : "";
  const freeOver = settings?.freeShippingOver ?? null;
  const symbol = settings?.currencySymbol || "";

  const chips: string[] = [];
  if (freeOver && freeOver > 0) {
    chips.push(
      L(lang, `شحن مجاني فوق ${freeOver} ${symbol}`, `Free shipping over ${freeOver} ${symbol}`)
    );
  }
  if (settings?.taxEnabled && settings.taxRate > 0) {
    chips.push(L(lang, "الأسعار تشمل الضريبة", "Prices include tax"));
  }

  const active = store.ready ? store.categories.filter((c) => c.active).slice(0, 6) : [];
  const ticker = active.length
    ? active.map((c) => L(lang, c.name, c.nameEn || c.name))
    : [storeName, tagline].filter(Boolean);

  return (
    <section ref={ref} className="hero relative isolate overflow-hidden bg-primary text-white">
      {/* الطبقة الأبعد: صورة الخلفية */}
      <div className="hero-layer hero-bg" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          loading="eager"
          decoding="async"
          className="photo-fade h-full w-full object-cover"
          onError={(e) => {
            e.currentTarget.src = PLACEHOLDER;
          }}
        />
      </div>

      {/* توهّج ذهبي يتبع المؤشّر */}
      <div className="hero-layer hero-glow" aria-hidden />

      {/* هالات عائمة */}
      <div className="hero-layer hero-orbs" aria-hidden>
        <span
          className="orb start-[4%] top-[14%] h-52 w-52"
          style={{ background: "radial-gradient(circle, rgb(198 161 91 / 0.55), transparent 70%)" }}
        />
        <span
          className="orb start-[68%] top-[8%] h-40 w-40"
          style={{
            background: "radial-gradient(circle, rgb(255 244 216 / 0.32), transparent 70%)",
            animationDelay: "1.4s",
          }}
        />
        <span
          className="orb start-[50%] top-[62%] h-64 w-64"
          style={{
            background: "radial-gradient(circle, rgb(122 78 191 / 0.5), transparent 70%)",
            animationDelay: "2.6s",
          }}
        />
      </div>

      {/* لمعة ضوئية تعبر القسم */}
      <div className="hero-sheen" aria-hidden />

      {/* تدريج لوضوح النص */}
      <div className="hero-scrim" aria-hidden />

      <div className="hero-content relative z-10 mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="max-w-2xl">
            <span
              className="reveal chip border border-gold/40 bg-white/10 text-gold-soft backdrop-blur"
              style={{ animationDelay: "60ms" }}
            >
              <span className="text-gold">✦</span>
              <span>{storeName}</span>
            </span>

            <h1
              className="reveal display mt-6 text-4xl font-semibold leading-[1.15] sm:text-5xl lg:text-6xl xl:text-7xl"
              style={{ animationDelay: "150ms" }}
            >
              <span className="shine">{title}</span>
            </h1>

            {subtitle && (
              <p
                className="reveal mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg"
                style={{ animationDelay: "250ms" }}
              >
                {subtitle}
              </p>
            )}

            <div className="reveal mt-8 flex flex-wrap gap-3" style={{ animationDelay: "340ms" }}>
              <Link href={ctaHref} className="btn btn-gold min-h-11 shadow-lg">
                {ctaText}
              </Link>
              <Link
                href="/products?tag=new"
                className="btn min-h-11 border border-white/60 bg-transparent text-white hover:bg-white hover:text-primary"
              >
                {t("newArrivals")}
              </Link>
            </div>

            {chips.length > 0 && (
              <div className="reveal mt-8 flex flex-wrap gap-2" style={{ animationDelay: "430ms" }}>
                {chips.map((chip) => (
                  <span
                    key={chip}
                    className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 backdrop-blur"
                  >
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-gold/25 text-[0.6rem] text-gold-soft">
                      ✓
                    </span>
                    {chip}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* قارورة ثلاثية الأبعاد */}
          <div className="hero-bottle relative hidden justify-self-center lg:block" aria-hidden>
            <span className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/25" />
            <span className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gold/15" />
            <span
              className="aurora absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2"
              style={{ background: "radial-gradient(circle, rgb(198 161 91 / 0.5), transparent 70%)" }}
            />
            <div className="floaty relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/bottle.svg"
                alt=""
                loading="eager"
                decoding="async"
                width={330}
                height={478}
                className="w-[270px] drop-shadow-[0_44px_60px_rgba(0,0,0,0.55)] xl:w-[320px]"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* شريط الأقسام المتحرك */}
      {ticker.length > 0 && (
        <div className="relative z-10 border-t border-white/10 bg-black/25 backdrop-blur">
          <div className="marquee-mask overflow-hidden py-3">
            <div className="marquee">
              {[0, 1].map((dup) => (
                <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
                  {ticker.map((item, index) => (
                    <span
                      key={`${dup}-${index}`}
                      className="flex items-center gap-4 whitespace-nowrap px-5 text-xs font-semibold uppercase tracking-[0.28em] text-white/70"
                    >
                      <span className="text-gold">✦</span>
                      {item}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
