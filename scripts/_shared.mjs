/**
 * VELUNORA — مساعدات مشتركة لسكربتات الصيانة (تشغيل من Node مباشرة).
 *
 * هذه السكربتات تتعامل مع محرّك التخزين المُختار في .env.local:
 *  - "local":   ملفات JSON داخل var/db (محاكاة مخطط Firestore)
 *  - "firebase": Firestore + Storage + Firebase Auth عبر Admin SDK
 *
 * لا تحتوي هذه الملفات أي بيانات اعتماد؛ تُقرأ من متغيرات البيئة فقط.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/* ============================ البيئة ============================ */

export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const full = path.join(process.cwd(), file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, "utf8");
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

export function driverName() {
  return (process.env.STORAGE_DRIVER || "local").toLowerCase() === "firebase" ? "firebase" : "local";
}

/* ============================ مسارات التخزين المحلي ============================ */

export const DATA_DIR = process.env.VELUNORA_DATA_DIR || path.join(process.cwd(), "var", "db");
export const UPLOAD_DIR = process.env.VELUNORA_UPLOAD_DIR || path.join(process.cwd(), "var", "uploads");
export const BACKUP_DIR = process.env.VELUNORA_BACKUP_DIR || path.join(process.cwd(), "backups");

/** أسماء ملفات المحرّك المحلي — يجب أن تطابق src/lib/store/local-driver.ts */
export const FILES = {
  products: "products.json",
  categories: "categories.json",
  orders: "orders.json",
  customers: "customers.json",
  carts: "carts.json",
  settings: "settings.json",
  pages: "pages.json",
  reviews: "reviews.json",
  admins: "admins.json",
  audit: "audit.json",
  tokens: "tokens.json",
  auth: "auth.json",
  meta: "meta.json",
};

export function readLocal(file, fallback) {
  const full = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(full, "utf8"));
  } catch {
    return fallback;
  }
}

export function writeLocal(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const full = path.join(DATA_DIR, file);
  const tmp = `${full}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  try {
    fs.renameSync(tmp, full);
  } catch {
    fs.rmSync(full, { force: true });
    fs.renameSync(tmp, full);
  }
}

export function localSeeded() {
  const meta = readLocal(FILES.meta, null);
  return Boolean(meta && meta.seeded);
}

/* ============================ أدوات مساعدة ============================ */

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export function slugify(value) {
  const base = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${crypto.randomUUID().slice(0, 6)}`;
}

export function newUid() {
  return `usr_${crypto.randomUUID()}`;
}

/** نفس صيغة scrypt المستخدمة في src/lib/server/credentials.ts */
export function hashPassword(password) {
  const N = 16384;
  const r = 8;
  const p = 1;
  const keylen = 64;
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, keylen, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

export const ALL_PERMISSIONS = ["products", "orders", "customers", "settings", "home", "pages", "audit"];

export function parsePermissions(value) {
  if (!value || value === true) return [];
  return String(value)
    .split(",")
    .map((x) => x.trim())
    .filter((x) => ALL_PERMISSIONS.includes(x));
}

export function log(message) {
  console.log(`[velunora] ${message}`);
}

export function fail(message) {
  console.error(`[velunora] ✖ ${message}`);
  process.exit(1);
}

/* ============================ Firebase Admin ============================ */

export async function getFirebaseAdmin() {
  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");

  const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || undefined;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || undefined;

  if (!getApps().length) {
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./service-account.json";
    let credentials;
    if (inline) {
      credentials = JSON.parse(inline);
    } else {
      const resolved = path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath);
      if (!fs.existsSync(resolved)) {
        throw new Error(
          "لم يتم العثور على ملف حساب الخدمة. اضبط FIREBASE_SERVICE_ACCOUNT_KEY_PATH أو FIREBASE_SERVICE_ACCOUNT_JSON."
        );
      }
      credentials = JSON.parse(fs.readFileSync(resolved, "utf8"));
    }
    initializeApp({ credential: cert(credentials), storageBucket: bucket, projectId });
  }
  const app = getApps()[0];
  return { app, auth: getAuth(app), db: getFirestore(app) };
}
