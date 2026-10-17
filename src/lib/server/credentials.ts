import "server-only";

import crypto from "node:crypto";
import { getDriver } from "@/lib/store";

/**
 * كلمات المرور في المحرك المحلي: scrypt مع ملح عشوائي.
 * الصيغة: scrypt$N$r$p$salt$hash
 */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  try {
    const salt = Buffer.from(saltB64, "base64url");
    const expected = Buffer.from(hashB64, "base64url");
    const actual = crypto.scryptSync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/** إنشاء رمز عشوائي وخزنه مُجزّأً (SHA-256) مع انتهاء صلاحية */
export async function issueToken(
  kind: "reset" | "verify",
  uid: string,
  ttlMinutes = 60
): Promise<string> {
  const raw = crypto.randomBytes(32).toString("base64url");
  const key = `${kind}_${crypto.createHash("sha256").update(raw).digest("hex")}`;
  const db = await getDriver();
  await db.saveToken({ key, uid, expiresAt: Date.now() + ttlMinutes * 60 * 1000 });
  return raw;
}

export async function consumeToken(kind: "reset" | "verify", raw: string): Promise<string | null> {
  if (!raw || typeof raw !== "string") return null;
  const key = `${kind}_${crypto.createHash("sha256").update(raw).digest("hex")}`;
  const db = await getDriver();
  const hit = await db.consumeToken(key);
  return hit?.uid ?? null;
}

export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 6 && password.length <= 128;
}

export function isValidPhone(phone: string): boolean {
  const digits = (phone || "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}
