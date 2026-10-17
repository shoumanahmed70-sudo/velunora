/**
 * VELUNORA — استعادة نسخة احتياطية.
 *
 * الاستخدام:
 *   npm run db:restore -- --file backups/velunora-backup-2026-...json
 *   npm run db:restore -- --file <path> --uploads backups/uploads-2026-...
 *   npm run db:restore                 # يستخدم أحدث ملف في مجلد backups
 *
 * تحذير: الاستعادة تستبدل البيانات الحالية. خذ نسخة احتياطية قبل التنفيذ.
 */

import fs from "node:fs";
import path from "node:path";
import { BACKUP_DIR, DATA_DIR, UPLOAD_DIR, driverName, getFirebaseAdmin, loadEnv, parseArgs, writeLocal, log, fail } from "./_shared.mjs";

loadEnv();
const args = parseArgs();
const driver = driverName();

function latestBackup() {
  if (!fs.existsSync(BACKUP_DIR)) fail("لا يوجد مجلد backups. نفّذ npm run db:backup أولًا.");
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("velunora-backup-") && f.endsWith(".json"))
    .sort();
  if (!files.length) fail("لا توجد نسخة احتياطية. نفّذ npm run db:backup أولًا.");
  return path.join(BACKUP_DIR, files[files.length - 1]);
}

const file = typeof args.file === "string" ? args.file : latestBackup();
if (!fs.existsSync(file)) fail(`الملف غير موجود: ${file}`);
const bundle = JSON.parse(fs.readFileSync(file, "utf8"));
if (bundle.app !== "velunora") fail("هذا الملف ليس نسخة احتياطية صالحة من VELUNORA.");

log(`الاستعادة من: ${file}`);
log(`محرّك النسخة: ${bundle.driver} | محرّكك الحالي: ${driver}`);
if (bundle.driver !== driver) {
  log("تنبيه: محرّك النسخة يختلف عن محرّكك الحالي؛ تأكد من أنك تعرف ما تفعله.");
}

if (driver === "firebase") {
  const { db } = await getFirebaseAdmin();
  const collections = bundle.collections || {};
  for (const [name, docs] of Object.entries(collections)) {
    let count = 0;
    for (const doc of docs) {
      const { id, ...data } = doc;
      await db.collection(name).doc(id).set(data, { merge: true });
      count += 1;
    }
    log(`  ${name}: ${count}`);
  }
  const settings = bundle.settings || [];
  for (const doc of settings) {
    const { id, ...data } = doc;
    await db.collection("settings").doc(id).set(data, { merge: true });
  }
  log(`  settings: ${settings.length}`);
} else {
  const files = bundle.files || {};
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    if (data === null || data === undefined) continue;
    writeLocal(name, data);
    log(`  ✓ ${name}`);
  }
  // ضمان أن التهيئة لن تستبدل البيانات المستعادة
  const meta = files["meta.json"] || { orderCounter: 0, idem: {}, seeded: true };
  writeLocal("meta.json", { ...meta, seeded: true });
}

if (typeof args.uploads === "string") {
  if (!fs.existsSync(args.uploads)) fail(`مجلد المرفوعات غير موجود: ${args.uploads}`);
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.cpSync(args.uploads, UPLOAD_DIR, { recursive: true });
  log(`✓ تمت استعادة المرفوعات إلى ${path.relative(process.cwd(), UPLOAD_DIR)}`);
}

log("انتهت الاستعادة. أعد تشغيل السيرفر إن كان يعمل.");
