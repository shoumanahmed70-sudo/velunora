import "server-only";

import type { OrderStatus } from "@/lib/types";

/**
 * حدود الطلبات المتكررة (في الذاكرة).
 *
 * تنبيه مهم: هذه الخريطة **محلية للنسخة الواحدة** من الخادم؛ عند تشغيل أكثر من
 * نسخة (توسّع أفقي خلف موازن تحميل) تصبح الحدود الفعلية مضاعفة بعدد النسخ.
 * للحماية الحقيقية في الإنتاج الموزّع استخدم Redis (مثلًا @upstash/ratelimit)
 * أو حدًّا على مستوى الـ WAF/الموازن.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  ok: boolean;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { ok: true, retryAfterSeconds: 0 };
  }
  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  bucket.count += 1;
  return { ok: true, retryAfterSeconds: 0 };
}

/**
 * استخراج عنوان العميل من الترويسات.
 *
 * لا نثق بـ x-forwarded-for افتراضيًا لأن العميل يستطيع تزويرها. السلوك:
 *  - TRUSTED_PROXY_HOPS = 0 (الافتراضي): لا نقرأ x-forwarded-for إطلاقًا،
 *    بل x-real-ip أو cf-connecting-ip أو "local".
 *  - TRUSTED_PROXY_HOPS = N (> 0): وكلاء موثوقون عددهم N يضيفون عناوينهم في
 *    نهاية السلسلة، فنأخذ العنوان من النهاية بعدد الوسطاء (آخر N مُوثوقون).
 *    مثال: N=1 و x-forwarded-for = "مزوّر, 9.9.9.9" → العنوان الحقيقي 9.9.9.9.
 */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const hops = Math.floor(Number(process.env.TRUSTED_PROXY_HOPS || 0)) || 0;

  if (hops <= 0) {
    if (headers.get("x-real-ip")) return headers.get("x-real-ip")!.trim();
    if (headers.get("cf-connecting-ip")) return headers.get("cf-connecting-ip")!.trim();
    return "local";
  }

  const chain = (headers.get("x-forwarded-for") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (chain.length === 0) return headers.get("x-real-ip")?.trim() || "local";
  const index = Math.max(0, chain.length - hops);
  return chain[index] || "local";
}

// تنظيف دوري بسيط لمنع تضخم الذاكرة
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of buckets) if (value.resetAt < now) buckets.delete(key);
  }, 60_000);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
}

/** بيانات مرئية للمستخدم: نُبقي فقط الحقول التي يملكها */
export const VISIBLE_STATUSES: OrderStatus[] = [
  "new",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];
