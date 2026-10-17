/**
 * VELUNORA — نسخة احتياطية للبيانات.
 *
 * الاستخدام:
 *   npm run db:backup
 *
 * الناتج:
 *   backups/velunora-backup-<timestamp>.json   (كل بيانات قاعدة البيانات في ملف واحد)
 *   backups/uploads-<timestamp>/               (نسخة من المرفوعات في المحرّك المحلي فقط)
 *
 * محرّك Firebase:
 *   - يُصدِّر مجموعات Firestore إلى ملف JSON واحد.
 *   - للنسخ الاحتياطي الكامل مع الصور يُنصح أيضًا باستخدام:
 *       gcloud firestore export gs://<bucket>/backups/<date>
 *     ونسخ مجلد Storage يدويًا (موثّق في README).
 */

import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR, FILES, UPLOAD_DIR, driverName, getFirebaseAdmin, loadEnv, log, readLocal } from "./_shared.mjs";

loadEnv();
const driver = driverName();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const bundle = {
  app: "velunora",
  version: 1,
  driver,
  createdAt: new Date().toISOString(),
};

if (driver === "firebase") {
  const { db } = await getFirebaseAdmin();
  const collections = ["products", "categories", "orders", "customers", "carts", "reviews", "admins", "audit", "pages", "counters", "tokens"];
  bundle.collections = {};
  for (const name of collections) {
    const snap = await db.collection(name).get();
    bundle.collections[name] = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    log(`  ${name}: ${snap.size}`);
  }
  const settingsSnap = await db.collection("settings").get();
  bundle.settings = settingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  log(`  settings: ${settingsSnap.size}`);
} else {
  bundle.files = {};
  for (const file of Object.values(FILES)) {
    bundle.files[file] = readLocal(file, null);
  }
  log(`  تم تجميع ${Object.keys(bundle.files).length} ملفًا من ${path.relative(process.cwd(), path.join(process.cwd(), "var", "db"))}`);
}

const outFile = path.join(BACKUP_DIR, `velunora-backup-${stamp}.json`);
fs.writeFileSync(outFile, JSON.stringify(bundle, null, 2), "utf8");
log(`✓ النسخة الاحتياطية: ${path.relative(process.cwd(), outFile)}`);

if (driver === "local" && fs.existsSync(UPLOAD_DIR)) {
  const outUploads = path.join(BACKUP_DIR, `uploads-${stamp}`);
  fs.mkdirSync(outUploads, { recursive: true });
  fs.cpSync(UPLOAD_DIR, outUploads, { recursive: true });
  log(`✓ نسخة المرفوعات: ${path.relative(process.cwd(), outUploads)}`);
}

log("انتهى النسخ الاحتياطي.");
