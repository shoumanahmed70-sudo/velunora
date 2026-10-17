import "server-only";

import { headers } from "next/headers";

/**
 * الرابط العام الأساسي (Base URL) لروابط البريد: التحقق من الحساب واستعادة كلمة المرور.
 *
 * الأولوية:
 *  1. APP_URL / NEXT_PUBLIC_SITE_URL إن حُدِّد صراحةً (نطاق ثابت مثل https://store.com).
 *  2. في الإنتاج: لا بديل — يُرمى خطأ واضح إن لم يُحدَّد (حماية من تسميم الروابط
 *     عبر ترويسة Host: مهاجم يرسل Host مزيفًا فتُبنى روابط البريد على نطاقه).
 *  3. في التطوير فقط: مضيف الطلب الحالي (x-forwarded-host/host) ثم localhost.
 */
export async function publicBaseUrl(): Promise<string> {
  const configured =
    process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // الإنتاج: الترويسات غير موثوقة إطلاقًا لبناء روابط تُرسَل بالبريد
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "متغيّر البيئة APP_URL (أو NEXT_PUBLIC_SITE_URL) إلزامي في الإنتاج لبناء روابط البريد، " +
        "ولا يُعتمد على ترويسة Host. أضفه إلى .env.local ثم أعد التشغيل."
    );
  }

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
