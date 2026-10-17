import type { StoreSettings } from "@/lib/types";

/** تنسيق المبالغ — يعتمد على رمز العملة من إعدادات المتجر. */
export function formatMoney(amount: number, settings?: Pick<StoreSettings, "currencySymbol"> | null): string {
  const symbol = settings?.currencySymbol?.trim() || "ر.س";
  const value = Number.isFinite(amount) ? amount : 0;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${formatted} ${symbol}`;
}

/** رقم الطلب/الهاتف: يعرض أرقامًا لاتينية دائمًا لسهولة النسخ والبحث. */
export function digitsOnly(value: string): string {
  return (value || "").replace(/[^\d+]/g, "");
}

/** تحويل الأرقام العربية-الهندية إلى لاتينية. */
export function normalizeDigits(value: string): string {
  const arabic = "٠١٢٣٤٥٦٧٨٩";
  const persian = "۰۱۲۳۴۵۶۷۸۹";
  return (value || "")
    .replace(/[٠-٩]/g, (d) => String(arabic.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(persian.indexOf(d)));
}
