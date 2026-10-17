import "server-only";

import crypto from "node:crypto";

/**
 * تشفير أسرار الإعدادات (كلمة سر SMTP) بـ AES-256-GCM.
 *
 * - المفتاح يُشتق من `SETTINGS_ENCRYPTION_KEY` (أي طول → SHA-256 → 32 بايت).
 * - الصيغة المخزّنة: `enc:v1:<iv>:<tag>:<cipher>` (كلها base64url).
 * - القيم القديمة غير المشفّرة تُقرأ كما هي (توافق خلفي دون نقل بيانات).
 * - بلا مفتاح: تُحفظ القيمة كما هي مع تحذير في السجل (لا نُعطّل المتجر).
 */

const PREFIX = "enc:v1:";

function key(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY?.trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest();
}

export function isEncryptedSecret(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** تشفير سرّ للتخزين. القيمة الفارغة تبقى فارغة. */
export function encryptSecret(plain: string): string {
  if (!plain) return "";
  if (isEncryptedSecret(plain)) return plain; // مشفّر مسبقًا
  const k = key();
  if (!k) {
    console.warn(
      "[velunora] SETTINGS_ENCRYPTION_KEY غير مُعدّ — كلمة سر SMTP تُخزَّن بلا تشفير. عيّنه في .env.local."
    );
    return plain;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

/** فك تشفير سرّ مخزّن. يتعامل مع القيم القديمة غير المشفّرة. */
export function decryptSecret(stored: string): string {
  if (!stored) return "";
  if (!isEncryptedSecret(stored)) return stored; // قيمة قديمة غير مشفّرة
  const k = key();
  if (!k) {
    console.error("[velunora] توجد قيمة مشفّرة لكن SETTINGS_ENCRYPTION_KEY غير مُعدّ — تعذّر فك التشفير.");
    return "";
  }
  try {
    const parts = stored.slice(PREFIX.length).split(":");
    if (parts.length !== 3) return "";
    const [ivB64, tagB64, dataB64] = parts;
    const decipher = crypto.createDecipheriv("aes-256-gcm", k, Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    const dec = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64url")), decipher.final()]);
    return dec.toString("utf8");
  } catch {
    console.error("[velunora] فشل فك تشفير سرّ الإعدادات (مفتاح خاطئ أو قيمة تالفة).");
    return "";
  }
}
