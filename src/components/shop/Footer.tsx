"use client";

import Link from "next/link";
import { useLang, useT } from "@/lib/i18n/provider";
import { useStoreSafe } from "@/components/shop/hooks";
import { L } from "@/components/shop/utils";
import {
  FacebookIcon,
  InstagramIcon,
  SnapchatIcon,
  TiktokIcon,
  WhatsappIcon,
  XIcon,
} from "@/components/shop/icons";

const POLICY_LINKS = [
  { slug: "about", key: "aboutUs" },
  { slug: "privacy", key: "privacy" },
  { slug: "terms", key: "terms" },
  { slug: "shipping", key: "shippingPolicy" },
  { slug: "returns", key: "returnsPolicy" },
] as const;

export function Footer() {
  const { lang } = useLang();
  const t = useT();
  const { settings, categories, contactWaUrl } = useStoreSafe();

  const storeName = settings?.storeName || "VELUNORA";
  const tagline = settings
    ? L(lang, settings.tagline, settings.taglineEn)
    : L(lang, "عطور فاخرة تُروى بالتفاصيل", "Luxury fragrances told in detail");
  const contact = settings?.contact;
  const social = settings?.social;

  const socials = [
    { key: "instagram", url: social?.instagram, label: "Instagram", Icon: InstagramIcon },
    { key: "tiktok", url: social?.tiktok, label: "TikTok", Icon: TiktokIcon },
    { key: "snapchat", url: social?.snapchat, label: "Snapchat", Icon: SnapchatIcon },
    { key: "facebook", url: social?.facebook, label: "Facebook", Icon: FacebookIcon },
    { key: "x", url: social?.x, label: "X", Icon: XIcon },
  ].filter((s) => Boolean(s.url && s.url.trim()));

  const year = new Date().getFullYear();
  const address = settings ? L(lang, contact?.address || "", contact?.addressEn || "") : "";

  return (
    <footer className="mt-20 border-t border-line bg-cream/60">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          {/* الهوية */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={settings?.logoUrl || "/brand/logo.svg"}
                alt={storeName}
                className="h-10 w-10 rounded-full object-cover ring-1 ring-line"
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  if (e.currentTarget.src.endsWith("/brand/logo.svg")) return;
                  e.currentTarget.src = "/brand/logo.svg";
                }}
              />
              <span className="display text-xl font-semibold tracking-wide text-ink">{storeName}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted">{tagline}</p>
            {socials.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {socials.map(({ key, url, label, Icon }) => (
                  <a
                    key={key}
                    href={url as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink transition-colors hover:border-gold hover:text-gold"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* روابط سريعة */}
          <div>
            <h3 className="mb-4 text-sm font-bold text-ink">{t("quickLinks")}</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="text-muted transition-colors hover:text-primary">
                  {t("home")}
                </Link>
              </li>
              <li>
                <Link href="/products" className="text-muted transition-colors hover:text-primary">
                  {t("productsNav")}
                </Link>
              </li>
              <li>
                <Link href="/products?tag=new" className="text-muted transition-colors hover:text-primary">
                  {t("newArrivals")}
                </Link>
              </li>
              <li>
                <Link href="/products?tag=sale" className="text-muted transition-colors hover:text-primary">
                  {t("onSale")}
                </Link>
              </li>
              <li>
                <Link href="/order/lookup" className="text-muted transition-colors hover:text-primary">
                  {t("orderLookup")}
                </Link>
              </li>
            </ul>
          </div>

          {/* الأقسام */}
          <div>
            <h3 className="mb-4 text-sm font-bold text-ink">{t("categories")}</h3>
            <ul className="space-y-2 text-sm">
              {categories.length === 0 && <li className="text-muted">—</li>}
              {categories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products?category=${encodeURIComponent(c.slug)}`}
                    className="text-muted transition-colors hover:text-primary"
                  >
                    {L(lang, c.name, c.nameEn)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* السياسات + التواصل */}
          <div className="space-y-6">
            <div>
              <h3 className="mb-4 text-sm font-bold text-ink">{t("policies")}</h3>
              <ul className="space-y-2 text-sm">
                {POLICY_LINKS.map((p) => (
                  <li key={p.slug}>
                    <Link href={`/p/${p.slug}`} className="text-muted transition-colors hover:text-primary">
                      {t(p.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {(contact?.phone || contact?.email || address || contact?.workingHours) && (
              <div>
                <h3 className="mb-3 text-sm font-bold text-ink">{t("contactInfoTitle")}</h3>
                <ul className="space-y-2 text-sm text-muted">
                  {contact?.phone && (
                    <li dir="ltr" className="text-start">
                      {contact.phone}
                    </li>
                  )}
                  {contact?.email && (
                    <li dir="ltr" className="text-start">
                      {contact.email}
                    </li>
                  )}
                  {address && <li>{address}</li>}
                  {contact?.workingHours && <li>{contact.workingHours}</li>}
                </ul>
              </div>
            )}

            {contactWaUrl && (
              <a
                href={contactWaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline min-h-11 w-full"
              >
                <WhatsappIcon size={18} />
                {t("whatsappContact")}
              </a>
            )}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-center text-xs text-muted sm:flex-row sm:text-start">
          <p>
            © {year} {storeName} — {t("allRights")}
          </p>
          <p className="display tracking-widest text-gold">VELUNORA</p>
        </div>
      </div>
    </footer>
  );
}
