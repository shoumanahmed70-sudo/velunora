import "server-only";

import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { getSessionSecret } from "@/lib/server/env";

export const SESSION_COOKIE = "vn_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 يومًا

/**
 * تحديد خاصية Secure ديناميكيًا:
 * - إن كانت الخدمة على HTTPS (عبر x-forwarded-proto أو APP_URL) → Secure (الأكثر أمانًا).
 * - على HTTP محلي (localhost أو عنوان شبكة محلية) → بدون Secure، وإلا يُرفض الكوكي
 *   ولا يستطيع المدير/العميل البقاء مسجّلًا بعد الدخول.
 * يمكن الإجبار عبر متغيّر البيئة COOKIE_SECURE=true|false.
 */
async function cookieSecure(): Promise<boolean> {
  const forced = process.env.COOKIE_SECURE;
  if (forced === "true") return true;
  if (forced === "false") return false;
  try {
    const h = await headers();
    const proto = (h.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
    if (proto) return proto === "https";
    const host = (h.get("host") || "").split(":")[0].toLowerCase();
    const isLocal = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    if (isLocal) return false;
  } catch {
    // خارج سياق الطلب: نرجع إلى الإعداد الافتراضي
  }
  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "";
  if (appUrl) return appUrl.startsWith("https://");
  return process.env.NODE_ENV === "production";
}

export interface SessionPayload {
  uid: string;
  /**
   * نسخة إبطال الجلسة. تُقارن مع `sessionVersion` في سجل العميل داخل `getSession`.
   * الجلسات القديمة بلا هذا الحقل تُعامل كنسخة 0.
   */
  ver: number;
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signature(body: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
}

export function createSessionValue(uid: string, ver = 0, maxAgeSeconds = MAX_AGE_SECONDS): string {
  const payload: SessionPayload = { uid, ver: Number.isFinite(ver) ? ver : 0, exp: Date.now() + maxAgeSeconds * 1000 };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${signature(body)}`;
}

export function verifySessionValue(value: string | undefined | null): SessionPayload | null {
  if (!value || !value.includes(".")) return null;
  const [body, sig] = value.split(".");
  if (!body || !sig) return null;
  const expected = signature(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.uid || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    // جلسات قديمة أُنشئت قبل إضافة الحقل: تُعامل كنسخة 0
    return { uid: payload.uid, ver: typeof payload.ver === "number" ? payload.ver : 0, exp: payload.exp };
  } catch {
    return null;
  }
}

/** نسخة جلسة العميل الحالية (0 إن لم يكن الحقل موجودًا) */
export async function getSessionVersion(uid: string): Promise<number> {
  try {
    const { getDriver } = await import("@/lib/store");
    const profile = await (await getDriver()).getCustomer(uid);
    return profile?.sessionVersion ?? 0;
  } catch {
    return 0;
  }
}

/**
 * قراءة الجلسة من الكوكي والتحقق من صحتها (خادم فقط).
 *
 * إضافةً إلى التحقق من التوقيع والانتهاء، نقارن نسخة الجلسة `ver` مع
 * `sessionVersion` في سجل العميل — فإن اختلفتا فالجلسة أُبطلت (تغيير/إعادة تعيين
 * كلمة المرور أو تعطيل الحساب) ونُعيد null.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const session = verifySessionValue(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  try {
    const { getDriver } = await import("@/lib/store");
    const profile = await (await getDriver()).getCustomer(session.uid);
    const current = profile?.sessionVersion ?? 0;
    if (current !== session.ver) return null;
  } catch {
    // تعذّرت قراءة السجل: لا نُبطل الجلسة بسبب خطأ عابر في قاعدة البيانات
  }
  return session;
}

/** قراءة الجلسة بالتوقيع فقط بلا فحص نسخة الإبطال (للتشخيص/الخروج). */
export async function getSessionRaw(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(uid: string, ver?: number): Promise<void> {
  const version = typeof ver === "number" ? ver : await getSessionVersion(uid);
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(uid, version), {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: await cookieSecure(),
    path: "/",
    maxAge: 0,
  });
}
