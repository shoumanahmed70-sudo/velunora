"use client";

import type { CartLine } from "@/lib/types";

/**
 * تخزين المتصفح (localStorage) — كل مفتاح مُنَطّق بصاحب الحساب.
 *
 * السبب: كان المفتاح واحدًا للجميع (`vn_cart` / `vn_last_order`)، فتنتقل سلة عميل
 * وآخر طلبه إلى عميل آخر يسجّل الدخول على نفس الجهاز. الآن لكل حساب مفتاحه
 * الخاص، وللزائر (غير المسجّل) مفتاح منفصل.
 *
 * مفتاح الزائر القديم `vn_cart` يُرحَّل مرة واحدة ثم يُحذف.
 */

const GUEST = "guest";
const LEGACY_CART_KEY = "vn_cart";
const LEGACY_LAST_ORDER_KEY = "vn_last_order";

export interface StoredLastOrder {
  number: string;
  phone: string;
  /** رابط ونص رسالة واتساب كما أعادهما الخادم عند إنشاء الطلب. */
  waUrl?: string;
  waMessage?: string;
}

function cartKey(uid?: string | null): string {
  return `vn_cart:${uid || GUEST}`;
}

function lastOrderKey(uid?: string | null): string {
  return `vn_last_order:${uid || GUEST}`;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* التخزين ممتلئ أو غير متاح */
  }
}

function removeKey(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* تجاهل */
  }
}

function sanitizeLines(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  return (value as CartLine[]).filter((l) => l && typeof l.productId === "string" && l.productId);
}

/** سلة صاحب الحساب (أو الزائر عند غياب المعرّف). */
export function readCartLocal(uid?: string | null): CartLine[] {
  const key = cartKey(uid);
  let parsed = readJson<CartLine[]>(key);

  // ترحيل المفتاح القديم المشترك — للزائر فقط، ومرة واحدة
  if (!parsed && !uid) {
    const legacy = readJson<CartLine[]>(LEGACY_CART_KEY);
    if (legacy) {
      const lines = sanitizeLines(legacy);
      writeJson(key, lines);
      removeKey(LEGACY_CART_KEY);
      return lines;
    }
  }

  return sanitizeLines(parsed);
}

export function writeCartLocal(uid: string | null | undefined, lines: CartLine[]): void {
  writeJson(cartKey(uid), lines);
}

/** يسحب سلة الزائر لنقلها إلى الحساب عند أول تسجيل دخول (ثم يحذفها فلا تتكرّر). */
export function takeGuestCart(): CartLine[] {
  const lines = readCartLocal(null);
  if (lines.length) removeKey(cartKey(null));
  return lines;
}

/** آخر طلب أنشأه صاحب الحساب — لعرض صفحة التأكيد. */
export function readLastOrder(uid?: string | null): StoredLastOrder | null {
  const key = lastOrderKey(uid);
  let parsed = readJson<StoredLastOrder>(key);

  if (!parsed && !uid) {
    const legacy = readJson<StoredLastOrder>(LEGACY_LAST_ORDER_KEY);
    if (legacy) {
      parsed = legacy;
      writeJson(key, legacy);
      removeKey(LEGACY_LAST_ORDER_KEY);
    }
  }

  if (!parsed?.number || !parsed?.phone) return null;
  return parsed;
}

export function writeLastOrder(uid: string | null | undefined, data: StoredLastOrder): void {
  writeJson(lastOrderKey(uid), data);
}
