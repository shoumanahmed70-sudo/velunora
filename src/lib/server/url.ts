import "server-only";

import { headers } from "next/headers";

/**
 * الرابط العام الأساسي (Base URL) لروابط البريد: التحقق من الحساب واستعادة كلمة المرور.
 *
 * الأولوية:
 *  1. APP_URL / NEXT_PUBLIC_SITE_URL إن حُدِّد صراحةً (نطاق ثابت مثل https://store.com).
 *  2. مضيف الطلب الحالي (x-forwarded-host/host) — ليعمل الرابط تلقائيًا على
 *     النطاق العام، أو نفق مؤقّت، أو عنوان الشبكة المحلية.
 *  3. localhost كحل أخير.
 *
 * بهذا لا تُرسَل روابط بريد تشير إلى localhost عندما يدخل العميل من الإنترنت.
 */
export async function publicBaseUrl(): Promise<string> {
  const configured =
    process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  try {
    const h = await headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    if (host) {
      const forwarded = (h.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
      const local = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.|10\.)/.test(host);
      const proto = forwarded || (local ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch {
    // خارج سياق الطلب — نكمل للبديل
  }

  return "http://localhost:3000";
}

/** يبني رابطًا مطلقًا على النطاق الحالي (مثال: /auth/verify?token=...). */
export async function publicUrl(path: string): Promise<string> {
  const base = await publicBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
