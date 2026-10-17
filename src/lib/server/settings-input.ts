import "server-only";

import { defaultHome, defaultPrivateSettings, defaultSettings } from "@/lib/store/defaults";
import type { Category, HomeSettings, PrivateSettings, StoreSettings } from "@/lib/types";

/**
 * التحقق من مدخلات الإعدادات ومزجها مع الافتراضيات.
 * لا يُقبل أي حقل غير معروف، والقيم الرقمية تُقيَّد في نطاقات منطقية.
 */

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

function str(value: unknown, max: number, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, max);
}

function color(value: unknown, fallback: string): string {
  const raw = str(value, 20);
  return /^#[0-9a-fA-F]{3,8}$/.test(raw) ? raw : fallback;
}

export function parseSettingsInput(body: unknown): StoreSettings {
  const b = (body || {}) as Record<string, unknown>;
  const base = defaultSettings();
  const colors = (b.colors || {}) as Record<string, unknown>;
  const contact = (b.contact || {}) as Record<string, unknown>;
  const social = (b.social || {}) as Record<string, unknown>;

  const freeShippingRaw = b.freeShippingOver;
  const freeShippingOver =
    freeShippingRaw === null || freeShippingRaw === undefined || freeShippingRaw === ""
      ? null
      : clampNumber(freeShippingRaw, 0, 0, 1_000_000);

  return {
    storeName: str(b.storeName, 60, base.storeName) || base.storeName,
    storeNameEn: str(b.storeNameEn, 60, base.storeNameEn),
    tagline: str(b.tagline, 160, base.tagline),
    taglineEn: str(b.taglineEn, 160, base.taglineEn),
    logoUrl: str(b.logoUrl, 500, base.logoUrl) || base.logoUrl,
    faviconUrl: str(b.faviconUrl, 500, base.faviconUrl) || base.faviconUrl,
    colors: {
      primary: color(colors.primary, base.colors.primary),
      primarySoft: color(colors.primarySoft, base.colors.primarySoft),
      gold: color(colors.gold, base.colors.gold),
      cream: color(colors.cream, base.colors.cream),
      background: color(colors.background, base.colors.background),
      text: color(colors.text, base.colors.text),
    },
    headingFont: str(b.headingFont, 40, base.headingFont) || base.headingFont,
    bodyFont: str(b.bodyFont, 40, base.bodyFont) || base.bodyFont,
    currency: str(b.currency, 10, base.currency) || base.currency,
    currencySymbol: str(b.currencySymbol, 8, base.currencySymbol) || base.currencySymbol,
    taxEnabled: b.taxEnabled === true,
    taxRate: clampNumber(b.taxRate, base.taxRate, 0, 50),
    shippingFee: clampNumber(b.shippingFee, base.shippingFee, 0, 100000),
    freeShippingOver,
    minOrder: clampNumber(b.minOrder, base.minOrder, 0, 1000000),
    ordersEnabled: b.ordersEnabled !== false,
    reviewsEnabled: b.reviewsEnabled !== false,
    contact: {
      phone: str(contact.phone, 30),
      email: str(contact.email, 160),
      address: str(contact.address, 240),
      addressEn: str(contact.addressEn, 240),
      workingHours: str(contact.workingHours, 120),
    },
    social: {
      instagram: str(social.instagram, 300),
      tiktok: str(social.tiktok, 300),
      snapchat: str(social.snapchat, 300),
      facebook: str(social.facebook, 300),
      x: str(social.x, 300),
    },
    announcement: str(b.announcement, 240),
    announcementEn: str(b.announcementEn, 240),
    seoTitle: str(b.seoTitle, 160, base.seoTitle) || base.seoTitle,
    seoDescription: str(b.seoDescription, 320, base.seoDescription) || base.seoDescription,
    seoKeywords: str(b.seoKeywords, 320, base.seoKeywords),
  };
}

export function parsePrivateSettingsInput(body: unknown): PrivateSettings {
  const b = (body || {}) as Record<string, unknown>;
  const base = defaultPrivateSettings();
  const smtp = (b.smtp || {}) as Record<string, unknown>;

  // رقم واتساب: أرقام فقط مع رمز الدولة
  const digits = str(b.whatsappNumber, 20).replace(/\D/g, "");
  if (digits && (digits.length < 8 || digits.length > 15)) {
    throw new Error("رقم واتساب غير صحيح: أدخل رمز الدولة ثم الرقم بدون + أو مسافات");
  }

  return {
    whatsappNumber: digits,
    smtp: {
      enabled: smtp.enabled === true,
      host: str(smtp.host, 160),
      port: Math.floor(clampNumber(smtp.port, base.smtp.port, 1, 65535)),
      secure: smtp.secure === true,
      user: str(smtp.user, 160),
      pass: typeof smtp.pass === "string" ? smtp.pass.slice(0, 200) : "",
      from: str(smtp.from, 200),
    },
  };
}

export function parseHomeInput(body: unknown): HomeSettings {
  const b = (body || {}) as Record<string, unknown>;
  const base = defaultHome();

  const banners = Array.isArray(b.banners)
    ? b.banners.slice(0, 12).map((rawItem, index) => {
        const item = (rawItem || {}) as Record<string, unknown>;
        return {
          id: str(item.id, 60) || `bn_${index}_${Date.now()}`,
          image: str(item.image, 500),
          title: str(item.title, 160),
          titleEn: str(item.titleEn, 160),
          subtitle: str(item.subtitle, 300),
          subtitleEn: str(item.subtitleEn, 300),
          buttonText: str(item.buttonText, 60),
          buttonTextEn: str(item.buttonTextEn, 60),
          buttonHref: str(item.buttonHref, 300),
          active: item.active !== false,
        };
      })
    : [];

  const validTypes = ["categories", "featured", "new", "sale", "bestsellers", "banner"] as const;
  const sections = Array.isArray(b.sections)
    ? b.sections.slice(0, 14).map((rawItem, index) => {
        const item = (rawItem || {}) as Record<string, unknown>;
        const type = str(item.type, 30) as (typeof validTypes)[number];
        return {
          id: str(item.id, 60) || `sec_${index}_${Date.now()}`,
          type: (validTypes as readonly string[]).includes(type) ? type : "featured",
          title: str(item.title, 120),
          titleEn: str(item.titleEn, 120),
          limit: Math.floor(clampNumber(item.limit, 8, 1, 24)),
          productIds: Array.isArray(item.productIds)
            ? item.productIds.map((p) => str(p, 80)).filter(Boolean).slice(0, 24)
            : [],
          image: str(item.image, 500),
          active: item.active !== false,
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index + 1,
        };
      })
    : base.sections;

  return {
    heroTitle: str(b.heroTitle, 160, base.heroTitle),
    heroTitleEn: str(b.heroTitleEn, 160, base.heroTitleEn),
    heroSubtitle: str(b.heroSubtitle, 400, base.heroSubtitle),
    heroSubtitleEn: str(b.heroSubtitleEn, 400, base.heroSubtitleEn),
    heroButtonText: str(b.heroButtonText, 60, base.heroButtonText),
    heroButtonTextEn: str(b.heroButtonTextEn, 60, base.heroButtonTextEn),
    heroButtonHref: str(b.heroButtonHref, 300, base.heroButtonHref) || base.heroButtonHref,
    heroImage: str(b.heroImage, 500, base.heroImage) || base.heroImage,
    banners,
    sections: sections.sort((a, b2) => a.order - b2.order),
  };
}

export function parseCategoryInput(body: unknown, id?: string): Category {
  const b = (body || {}) as Record<string, unknown>;
  const name = str(b.name, 60);
  if (name.length < 2) throw new Error("اسم القسم مطلوب");
  const slugSource = str(b.slug, 60) || name;
  const slug =
    slugSource
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || `cat-${Date.now()}`;
  return {
    id: id || slug,
    slug,
    name,
    nameEn: str(b.nameEn, 60) || name,
    order: Math.floor(clampNumber(b.order, 99, 0, 999)),
    active: b.active !== false,
  };
}
