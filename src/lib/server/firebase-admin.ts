import "server-only";

import fs from "node:fs";
import path from "node:path";
import type { App } from "firebase-admin/app";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

import { FIREBASE_WEB_CONFIG } from "@/lib/server/env";

/**
 * تهيئة Firebase Admin SDK من جهة الخادم فقط.
 * المفاتيح السرية لا تُرسل للمتصفح إطلاقًا، وصلاحية المدير لا تُمنح أبدًا
 * بناءً على قيمة يرسلها المتصفح — بل من سجل admins على الخادم أو من Custom Claims.
 */

let app: App | null = null;

function loadServiceAccount(): Record<string, unknown> {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON غير صالح");
    }
  }

  const keyPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH || "./service-account.json";
  const resolved = path.isAbsolute(keyPath) ? keyPath : path.join(process.cwd(), keyPath);
  if (!fs.existsSync(resolved)) {
    throw new Error(
      "لم يتم العثور على ملف حساب الخدمة. ضع FIREBASE_SERVICE_ACCOUNT_KEY_PATH أو FIREBASE_SERVICE_ACCOUNT_JSON في متغيرات البيئة."
    );
  }
  return JSON.parse(fs.readFileSync(resolved, "utf8")) as Record<string, unknown>;
}

export function getFirebaseApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length) {
    app = existing[0];
    return app;
  }
  const credentials = loadServiceAccount();
  app = initializeApp({
    credential: cert(credentials as Parameters<typeof cert>[0]),
    storageBucket: FIREBASE_WEB_CONFIG.storageBucket || undefined,
    projectId: FIREBASE_WEB_CONFIG.projectId || undefined,
  });
  return app;
}

export function getFirebaseAdmin() {
  const instance = getFirebaseApp();
  return {
    app: instance,
    auth: () => getAuth(instance),
    db: () => getFirestore(instance),
    storage: () => getStorage(instance),
  };
}
