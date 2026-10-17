import "server-only";

import crypto from "node:crypto";
import { getDriver } from "@/lib/store";
import {
  consumeToken,
  hashPassword,
  isValidEmail,
  isValidPassword,
  issueToken,
  normalizeEmail,
  verifyPassword,
} from "@/lib/server/credentials";
import { badRequest, forbidden } from "@/lib/server/errors";
import { resetEmailTemplate, sendMail, verifyEmailTemplate } from "@/lib/server/mailer";
import { ALLOW_DEV_LINKS, FIREBASE_WEB_CONFIG, STORAGE_DRIVER } from "@/lib/server/env";
import { publicUrl } from "@/lib/server/url";

export interface AuthResult {
  uid: string;
  devLink?: string;
  mailSent?: boolean;
  mailDisabled?: boolean;
}

function newUid(): string {
  return `usr_${crypto.randomUUID()}`;
}

/**
 * يضمن وجود سجل عميل للحساب دون المساس ببياناته المحفوظة.
 *
 * مهم: لا نستبدل `name` أو `phone` عند كل تسجيل دخول — بعض مزوّدي الدخول
 * (Firebase/Google) لا يُرجعان رقم الجوال، والقيم الفارغة كانت تمحو ما أدخله
 * العميل سابقًا. نستبدل فقط بقيمة جديدة صريحة وغير فارغة.
 */
async function ensureCustomer(input: {
  uid: string;
  email: string;
  name: string;
  phone?: string;
}): Promise<void> {
  const db = await getDriver();
  const existing = await db.getCustomer(input.uid);
  const now = Date.now();

  const explicitName = (input.name || "").trim();
  const explicitPhone = (input.phone || "").trim();

  await db.upsertCustomer({
    uid: input.uid,
    email: normalizeEmail(input.email),
    // القيمة الجديدة إن وُجدت، وإلا المحفوظة، وإلا اسم من البريد (للإنشاء الجديد فقط)
    name: explicitName || existing?.name || input.email.split("@")[0],
    phone: explicitPhone || existing?.phone || "",
    city: existing?.city || "",
    address: existing?.address || "",
    emailVerified: existing?.emailVerified ?? false,
    disabled: existing?.disabled ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
}

async function tokenUrl(path: string, token: string, lang = "ar"): Promise<string> {
  const url = await publicUrl(path);
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}token=${encodeURIComponent(token)}&lang=${lang}`;
}

/* ============================ المحرك المحلي ============================ */

async function localRegister(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw badRequest("البريد الإلكتروني غير صحيح", "validation");
  if (!isValidPassword(input.password)) throw badRequest("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "weak_password");

  const db = await getDriver();
  const existing = await db.getCustomerByEmail(email);
  if (existing) throw badRequest("هذا البريد مسجّل بالفعل", "email_exists");

  const uid = newUid();
  await ensureCustomer({ uid, email, name: input.name, phone: input.phone });
  await db.saveAuthSecret(uid, hashPassword(input.password));

  const { devLink } = await sendVerification(uid).catch(() => ({ devLink: undefined }));
  return { uid, devLink };
}

async function localLogin(email: string, password: string): Promise<string> {
  const db = await getDriver();
  const profile = await db.getCustomerByEmail(normalizeEmail(email));
  if (!profile) throw badRequest("بيانات الدخول غير صحيحة", "invalid_credentials");
  const secret = await db.getAuthSecret(profile.uid);
  if (!verifyPassword(password, secret)) throw badRequest("بيانات الدخول غير صحيحة", "invalid_credentials");
  if (profile.disabled) throw forbidden("هذا الحساب معطّل، تواصل مع المتجر", "disabled");
  return profile.uid;
}

/* ============================ Firebase ============================ */

async function firebaseAdmin() {
  const { getFirebaseAdmin } = await import("@/lib/server/firebase-admin");
  return getFirebaseAdmin();
}

/**
 * رموز Firebase التي تعني «بيانات دخول غير صحيحة».
 * نترجمها جميعًا إلى رسالة عربية موحّدة ولا نكشف أيّها حدث (منع enumeration).
 */
const FIREBASE_CREDENTIAL_ERRORS = new Set([
  "EMAIL_NOT_FOUND",
  "INVALID_PASSWORD",
  "INVALID_LOGIN_CREDENTIALS",
  "INVALID_EMAIL",
  "MISSING_PASSWORD",
  "USER_DISABLED",
]);

async function firebaseREST(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${FIREBASE_WEB_CONFIG.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & { error?: { message?: string } };
  if (!res.ok) {
    // مثال: "INVALID_LOGIN_CREDENTIALS" أو "WEAK_PASSWORD : Password should be at least 8 characters"
    const raw = String(data?.error?.message || "UNKNOWN");
    const code = raw.split(":")[0]!.trim();
    if (FIREBASE_CREDENTIAL_ERRORS.has(code)) {
      // رسالة موحّدة: لا نكشف إن كان البريد غير موجود أم كلمة المرور خاطئة
      throw badRequest("بيانات الدخول غير صحيحة", "invalid_credentials");
    }
    // لا يُسرَّب رمز Firebase الخام للمستخدم؛ يُسجَّل على الخادم فقط
    console.error("[velunora] firebase error:", raw);
    throw badRequest("تعذّر إكمال العملية، حاول لاحقًا", "firebase_error");
  }
  return data;
}

/**
 * يزيد نسخة إبطال الجلسات للحساب، فتصبح كل الجلسات القائمة (على كل الأجهزة)
 * غير صالحة فورًا. تُستدعى عند تغيير/إعادة تعيين كلمة المرور وعند تعطيل الحساب.
 * تُعيد النسخة الجديدة (لإعادة إصدار جلسة الجهاز الحالي).
 */
export async function bumpSessionVersion(uid: string): Promise<number> {
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) return 0;
  const next = (profile.sessionVersion ?? 0) + 1;
  await db.upsertCustomer({ ...profile, sessionVersion: next, updatedAt: Date.now() });
  return next;
}

async function firebaseRegister(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw badRequest("البريد الإلكتروني غير صحيح", "validation");
  if (!isValidPassword(input.password)) throw badRequest("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "weak_password");

  const admin = await firebaseAdmin();
  try {
    const user = await admin.auth().createUser({
      email,
      password: input.password,
      displayName: input.name,
      emailVerified: false,
    });
    await ensureCustomer({ uid: user.uid, email, name: input.name, phone: input.phone });
    const { devLink } = await sendVerification(user.uid).catch(() => ({ devLink: undefined }));
    return { uid: user.uid, devLink };
  } catch (error) {
    const code = (error as { code?: string }).code || "";
    if (code.includes("email-already-exists")) throw badRequest("هذا البريد مسجّل بالفعل", "email_exists");
    throw error;
  }
}

async function firebaseLogin(email: string, password: string): Promise<string> {
  const data = await firebaseREST("accounts:signInWithPassword", {
    email: normalizeEmail(email),
    password,
    returnSecureToken: true,
  });
  const uid = String(data.localId || "");
  const displayName = String(data.displayName || "");
  if (!uid) throw badRequest("بيانات الدخول غير صحيحة", "invalid_credentials");
  await ensureCustomer({ uid, email, name: displayName || normalizeEmail(email) });
  const profile = await (await getDriver()).getCustomer(uid);
  if (profile?.disabled) throw forbidden("هذا الحساب معطّل، تواصل مع المتجر", "disabled");
  return uid;
}

/* ============================ الواجهة الموحّدة ============================ */

export const authDriver = STORAGE_DRIVER;

export async function register(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}): Promise<AuthResult> {
  if (STORAGE_DRIVER === "firebase") return firebaseRegister(input);
  return localRegister(input);
}

export async function login(email: string, password: string): Promise<string> {
  if (!email || !password) throw badRequest("أدخل البريد وكلمة المرور", "validation");
  if (STORAGE_DRIVER === "firebase") return firebaseLogin(email, password);
  return localLogin(email, password);
}

/** جلسة من رمز Firebase ID (تسجيل Google) */
export async function sessionFromIdToken(idToken: string): Promise<string> {
  if (STORAGE_DRIVER !== "firebase") {
    throw badRequest("تسجيل Google غير مُفعّل في هذا الوضع", "validation");
  }
  const admin = await firebaseAdmin();
  const decoded = await admin.auth().verifyIdToken(idToken).catch(() => null);
  if (!decoded?.uid) throw badRequest("رمز الدخول غير صالح", "invalid_token");
  await ensureCustomer({
    uid: decoded.uid,
    email: decoded.email || "",
    name: decoded.name || (decoded.email || "").split("@")[0],
  });
  const profile = await (await getDriver()).getCustomer(decoded.uid);
  if (profile?.disabled) throw forbidden("هذا الحساب معطّل، تواصل مع المتجر", "disabled");
  return decoded.uid;
}

export async function sendReset(email: string): Promise<AuthResult> {
  const clean = normalizeEmail(email);
  if (!isValidEmail(clean)) throw badRequest("البريد الإلكتروني غير صحيح", "validation");
  const db = await getDriver();
  const profile = await db.getCustomerByEmail(clean);

  // لا نكشف وجود البريد من عدمه
  if (!profile) {
    return { uid: "", mailSent: true };
  }

  if (STORAGE_DRIVER === "firebase") {
    await firebaseREST("accounts:sendOobCode", { requestType: "PASSWORD_RESET", email: clean });
    return { uid: profile.uid, mailSent: true };
  }

  const token = await issueToken("reset", profile.uid, 60);
  const link = await tokenUrl("/auth/reset", token);
  const settings = await db.getSettings();
  const template = resetEmailTemplate(settings.storeName, link, 60);
  const result = await sendMail({ to: clean, subject: template.subject, html: template.html });

  return {
    uid: profile.uid,
    mailSent: result.sent,
    mailDisabled: !result.sent,
    devLink: !result.sent && ALLOW_DEV_LINKS ? link : undefined,
  };
}

/**
 * تغيير كلمة مرور الحساب الحالي (عميل أو مدير — الحساب واحد).
 * يتحقق من كلمة المرور الحالية قبل التعيين، ولا يعتمد على البريد.
 * يُعيد نسخة إبطال الجلسة الجديدة (لإعادة إصدار جلسة الجهاز الحالي فقط).
 */
export async function changePassword(
  uid: string,
  currentPassword: string,
  newPassword: string
): Promise<number> {
  if (!isValidPassword(newPassword)) {
    throw badRequest("كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل", "weak_password");
  }
  if (!currentPassword) throw badRequest("أدخل كلمة المرور الحالية", "validation");
  if (currentPassword === newPassword) {
    throw badRequest("كلمة المرور الجديدة مطابقة للحالية", "same_password");
  }

  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw badRequest("الحساب غير موجود", "not_found");

  if (STORAGE_DRIVER === "firebase") {
    // التحقق من الكلمة الحالية عبر Firebase ثم التعيين بمفتاح الخدمة
    await firebaseREST("accounts:signInWithPassword", {
      email: profile.email,
      password: currentPassword,
      returnSecureToken: true,
    });
    const admin = await firebaseAdmin();
    await admin.auth().updateUser(uid, { password: newPassword });
    // إبطال الجلسات القديمة على كل الأجهزة
    return bumpSessionVersion(uid);
  }

  const secret = await db.getAuthSecret(uid);
  if (!verifyPassword(currentPassword, secret)) {
    throw badRequest("كلمة المرور الحالية غير صحيحة", "invalid_credentials");
  }
  await db.saveAuthSecret(uid, hashPassword(newPassword));
  // إبطال الجلسات القديمة على كل الأجهزة
  return bumpSessionVersion(uid);
}

export async function resetPassword(token: string, password: string): Promise<void> {
  if (!isValidPassword(password)) throw badRequest("كلمة المرور يجب أن تكون 8 أحرف على الأقل", "weak_password");
  if (STORAGE_DRIVER === "firebase") {
    throw badRequest(
      "إعادة التعيين في وضع Firebase تتم عبر رابط البريد الذي ترسله Firebase، افتح الرابط من بريدك.",
      "use_firebase_link"
    );
  }
  const uid = await consumeToken("reset", token);
  if (!uid) throw badRequest("رابط إعادة التعيين غير صالح أو منتهي", "invalid_token");
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw badRequest("الحساب غير موجود", "invalid_token");
  await db.saveAuthSecret(uid, hashPassword(password));
  // إبطال كل الجلسات القديمة بعد إعادة التعيين
  await bumpSessionVersion(uid);
}

export async function sendVerification(uid: string): Promise<{ devLink?: string; mailSent?: boolean }> {
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw badRequest("الحساب غير موجود", "validation");
  if (profile.emailVerified) return {};

  if (STORAGE_DRIVER === "firebase") {
    // نطلب من Firebase إرسال رسالة التأكيد (تتطلب رمز هوية مؤقتًا)
    const admin = await firebaseAdmin();
    const customToken = await admin.auth().createCustomToken(uid);
    const session = await firebaseREST("accounts:signInWithCustomToken", {
      token: customToken,
      returnSecureToken: true,
    });
    await firebaseREST("accounts:sendOobCode", {
      requestType: "VERIFY_EMAIL",
      idToken: String(session.idToken),
    });
    return { mailSent: true };
  }

  const token = await issueToken("verify", uid, 60 * 24);
  const link = await tokenUrl("/auth/verify", token);
  const settings = await db.getSettings();
  const template = verifyEmailTemplate(settings.storeName, link, 60 * 24);
  const result = await sendMail({ to: profile.email, subject: template.subject, html: template.html });
  return {
    mailSent: result.sent,
    devLink: !result.sent && ALLOW_DEV_LINKS ? link : undefined,
  };
}

export async function verifyEmail(token: string): Promise<void> {
  if (STORAGE_DRIVER === "firebase") {
    throw badRequest(
      "في وضع Firebase يتم التأكيد من رابط البريد الرسمي لـ Firebase مباشرة.",
      "use_firebase_link"
    );
  }
  const uid = await consumeToken("verify", token);
  if (!uid) throw badRequest("رابط التأكيد غير صالح أو منتهي", "invalid_token");
  const db = await getDriver();
  const profile = await db.getCustomer(uid);
  if (!profile) throw badRequest("الحساب غير موجود", "invalid_token");
  await db.upsertCustomer({ ...profile, emailVerified: true, updatedAt: Date.now() });
}

/** مزامنة حالة تأكيد البريد من Firebase (تُستدعى في /api/auth/me) */
export async function syncFirebaseEmailVerified(uid: string): Promise<void> {
  if (STORAGE_DRIVER !== "firebase") return;
  try {
    const db = await getDriver();
    const profile = await db.getCustomer(uid);
    if (!profile || profile.emailVerified) return;
    const admin = await firebaseAdmin();
    const user = await admin.auth().getUser(uid);
    if (user.emailVerified) {
      await db.upsertCustomer({ ...profile, emailVerified: true, updatedAt: Date.now() });
    }
  } catch {
    /* لا نعطّل الجلسة إن فشلت المزامنة */
  }
}
