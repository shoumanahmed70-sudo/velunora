/**
 * أدوات واجهة المتجر — دوال نقية مشتركة (بدون حالة).
 * لا تُصدّر أي حساب مالي معتمد؛ كلها للعرض فقط والخادم هو المرجع.
 */
import type { Lang } from "@/lib/i18n/dict";
import type { Product, ProductVariant, StoreSettings } from "@/lib/types";

export const PLACEHOLDER = "/brand/placeholder.svg";

/** نص ثنائي اللغة: عربي افتراضي، والإنجليزية عند توفرها. */
export function L(lang: Lang, ar: string, en: string): string {
  return lang === "en" && en ? en : ar;
}

/** أول صورة صالحة أو الصورة البديلة. */
export function productImage(images?: string[] | null): string {
  const first = (images || []).find((i) => typeof i === "string" && i.trim().length > 0);
  return first || PLACEHOLDER;
}

export function localizedName(product: Pick<Product, "name" | "nameEn">, lang: Lang): string {
  return L(lang, product.name, product.nameEn);
}

export function localizedDescription(
  product: Pick<Product, "description" | "descriptionEn">,
  lang: Lang
): string {
  return L(lang, product.description, product.descriptionEn);
}

/** الحجم المعروض على البطاقة: الأرخص (الأصغر عادةً) أو null. */
export function displayVariant(product: Pick<Product, "variants">): ProductVariant | null {
  const variants = product.variants || [];
  if (!variants.length) return null;
  return [...variants].sort((a, b) => a.price - b.price)[0] ?? null;
}

/** أول حجم متوفر في المخزون. */
export function availableVariant(product: Pick<Product, "variants">): ProductVariant | null {
  const variants = product.variants || [];
  return variants.find((v) => v.stock > 0) ?? null;
}

/** هل المنتج متوفر (على مستوى الأحجام أو المنتج)؟ */
export function hasStock(product: Pick<Product, "variants" | "stock">): boolean {
  const variants = product.variants || [];
  return variants.length ? variants.some((v) => v.stock > 0) : product.stock > 0;
}

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface EstimateLine {
  unitPrice: number;
  compareAt: number | null;
  qty: number;
}

export interface EstimateTotals {
  subtotal: number;
  discount: number;
  net: number;
  shipping: number;
  tax: number;
  total: number;
}

/**
 * تقدير المجاميع للعرض فقط (يطابق منطق الخادم في computeTotals).
 * المرجع النهائي دائمًا هو الخادم عند تأكيد الطلب.
 *
 * `compareAt` سعر «قبل الخصم» للعرض فقط، ولا يُطرح كخصم إضافي.
 */
export function estimateTotals(lines: EstimateLine[], settings: StoreSettings | null): EstimateTotals {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
  const discount = 0;
  const net = round2(subtotal - discount);

  let shipping = round2(settings?.shippingFee || 0);
  if (net <= 0) shipping = 0;
  else if (settings?.freeShippingOver != null && net >= settings.freeShippingOver) shipping = 0;

  const tax = settings?.taxEnabled ? round2(((net + shipping) * (settings.taxRate || 0)) / 100) : 0;
  const total = round2(net + shipping + tax);
  return { subtotal, discount, net, shipping, tax, total };
}
