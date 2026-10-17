import "server-only";

import { NextResponse } from "next/server";
import { HttpError } from "@/lib/server/errors";
import { PricingError } from "@/lib/server/pricing";

/** استجابة JSON موحّدة */
export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

/** تحويل أي خطأ إلى استجابة نظيفة لا تكشف تفاصيل داخلية */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return json({ error: error.message, code: error.code }, error.status);
  }
  if (error instanceof PricingError) {
    const status = error.code === "stock" ? 409 : error.code === "not_found" ? 404 : 400;
    return json({ error: error.message, code: error.code }, status);
  }
  // أخطاء غير متوقعة: تُسجّل على الخادم فقط
  console.error("[velunora] unhandled error:", error);
  return json({ error: "تعذّر إتمام العملية، حاول لاحقًا", code: "server_error" }, 500);
}

/**
 * غلاف موحّد لكل مسارات الـ API.
 * يقبل أي كائن `Response` (بمافيها `NextResponse` وملفات CSV/الصور) ويحوّل الأخطاء إلى JSON.
 */
export function route<T extends unknown[]>(
  handler: (...args: T) => Response | Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** قراءة جسم JSON مع حد أعلى للحجم */
export async function readJson<T>(request: Request, maxBytes = 64 * 1024): Promise<T> {
  // فحص مبكر عبر Content-Length (إن وُجد) لرفض الأحجام الكبيرة قبل قراءة الجسم
  const declared = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError("حجم البيانات كبير جدًا", 413, "payload_too_large");
  }
  const text = await request.text();
  // القياس بالبايتات الفعلية: `text.length` يقيس الوحدات لا البايتات، والنص العربي
  // (UTF-8) يأخذ أكثر من بايت لكل حرف، فنقيس بالبايت ليكون الحد دقيقًا.
  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new HttpError("حجم البيانات كبير جدًا", 413, "payload_too_large");
  }
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError("صيغة البيانات غير صحيحة", 400, "validation");
  }
}

export function asString(value: unknown, maxLength = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

export function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}
