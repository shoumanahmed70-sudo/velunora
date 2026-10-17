import "server-only";

import crypto from "node:crypto";

/**
 * أرقام الطلبات.
 *
 * رقم الطلب قابل للتخمين سابقًا (`VN-1001`, `VN-1002` …) فأيّ زائر يستطيع تجربة
 * أرقام متتالية. الآن نضيف لاحقة عشوائية قصيرة (4 رموز من A-Z0-9) فيصبح الرقم
 * مثل `VN-1003-K7Q2` — يبقى العدّاد للقراءة البشرية والتوافق مع الطلبات القديمة،
 * وتصبح إمكانية التخمين ضئيلة (36^4 ≈ 1.68 مليون احتمال لكل عدّاد).
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/** لاحقة عشوائية من A-Z0-9 بطول محدّد (افتراضيًا 4 رموز). */
export function orderNumberSuffix(length = 4): string {
  const size = Math.max(1, Math.min(12, Math.floor(length)));
  const bytes = crypto.randomBytes(size);
  let out = "";
  for (let i = 0; i < size; i += 1) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** يبني رقم الطلب: `VN-` + العدّاد + لاحقة عشوائية. */
export function makeOrderNumber(counter: number): string {
  return `VN-${1000 + Math.floor(counter)}-${orderNumberSuffix(4)}`;
}
