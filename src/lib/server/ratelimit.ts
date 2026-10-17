import "server-only";

import type { OrderStatus } from "@/lib/types";

/** حدود الطلبات المتكررة (في الذاكرة — تكفي لنسخة واحدة؛ للإنتاج الموزّع استخدم Redis/WAF). */
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

/** استخراج عنوان العميل من الترويسات (بدون الاعتماد عليه أمنيًا بشكل مطلق). */
export function clientIp(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || "local";
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
