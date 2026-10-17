import "server-only";

/**
 * قراءة إعدادات البيئة مع تحقق واضح وأخطاء لا تكشف أسرارًا.
 */

export type StorageDriverName = "local" | "firebase";

const driverRaw = (process.env.STORAGE_DRIVER || "local").toLowerCase();
export const STORAGE_DRIVER: StorageDriverName = driverRaw === "firebase" ? "firebase" : "local";

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET مطلوب في الإنتاج. أنشئ قيمة عشوائية وضعها في .env.local قبل النشر."
    );
  }
  return "dev-insecure-session-secret-change-me";
}

export const FIREBASE_WEB_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const FIREBASE_ENABLED = STORAGE_DRIVER === "firebase" && !!FIREBASE_WEB_CONFIG.apiKey;

export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true" &&
  FIREBASE_ENABLED &&
  !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

/**
 * روابط إعادة التعيين/التحقق "وضع التطوير".
 * الشّرطان معًا (وتم توثيقهما أيضًا في تعليقات المسارات):
 *  1) NODE_ENV !== "production": في الإنتاج (`npm start`) **ممنوع نهائيًا** تسريب
 *     هذه الروابط حتى لو كانت القيمة true — سطرًا واحدًا يمنع الاستيلاء على الحسابات.
 *  2) قيمة عددية غير عامة `VELUNORA_DEV_RESET_LINKS=true` — متغير أع改 (بلا
 *     NEXT_PUBLIC_ prefix) ليُقرأ وقت التشغيل ولا يتم تضمينه وقت البناء؛
 *     لأن `NEXT_PUBLIC_*` في Next.js تُنسخ داخل الحزمة وقت `next build`،
 *     فتغيير `.env.local` بعد البناء لا يأثر في الإنتاج.
 * استبدال كلمة مرور بدون SMTP في الإنتاج يتم عبر:
 *   npm run admin:create -- --email .. --password .. --name .. --role owner
 */
export const ALLOW_DEV_LINKS =
  process.env.NODE_ENV !== "production" &&
  (process.env.VELUNORA_DEV_RESET_LINKS ?? process.env.NEXT_PUBLIC_ALLOW_DEV_RESET_LINKS) === "true";

/** حدود رفع الصور */
export const UPLOAD_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
];
