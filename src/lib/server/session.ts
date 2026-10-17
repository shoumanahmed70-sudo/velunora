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
  exp: number;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function signature(body: string): string {
  return crypto.createHmac("sha256", getSessionSecret()).update(body).digest("base64url");
}

export function createSessionValue(uid: string, maxAgeSeconds = MAX_AGE_SECONDS): string {
  const payload: SessionPayload = { uid, exp: Date.now() + maxAgeSeconds * 1000 };
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
    return payload;
  } catch {
    return null;
  }
}

/** قراءة الجلسة من الكوكي (خادم فقط) */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySessionValue(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(uid: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionValue(uid), {
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
