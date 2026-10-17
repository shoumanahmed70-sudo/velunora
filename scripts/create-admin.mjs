/**
 * VELUNORA — إنشاء أو تحديث حساب مدير (owner/staff).
 *
 * الاستخدام:
 *   npm run admin:create -- --email owner@example.com --password "كلمة مرور قوية" --name "مالك المتجر" --role owner
 *   npm run admin:create -- --email staff@example.com --password "..." --role staff --permissions products,orders
 *
 * ملاحظات:
 *  - لا يوجد تسجيل مدير من الموقع إطلاقًا؛ هذه الطريقة الوحيدة (بالإضافة إلى لوحة "الموظفون" للمالك).
 *  - في محرّك "local" يُنشأ الحساب ويمكنه الدخول من /admin/login مباشرة.
 *  - في محرّك "firebase" يُنشأ مستخدم Firebase Auth + سجل admins في Firestore.
 */

import { FILES, getFirebaseAdmin, loadEnv, parseArgs, parsePermissions, readLocal, writeLocal, normalizeEmail, isValidEmail, newUid, hashPassword, driverName, log, fail } from "./_shared.mjs";

loadEnv();

const args = parseArgs();
const email = normalizeEmail(args.email);
const password = typeof args.password === "string" ? args.password : "";
const name = (typeof args.name === "string" && args.name) || email.split("@")[0] || "مدير";
const role = args.role === "owner" ? "owner" : "staff";
const permissions = role === "owner" ? [] : parsePermissions(args.permissions);
const active = args.inactive !== true;
const explicitUid = typeof args.uid === "string" ? args.uid : "";

if (!isValidEmail(email)) fail("البريد الإلكتروني مطلوب وصحيح: --email owner@example.com");
if (password && password.length < 6) fail("كلمة المرور يجب أن تكون 6 أحرف على الأقل");

async function runLocal() {
  const now = Date.now();
  const admins = readLocal(FILES.admins, []);
  const customers = readLocal(FILES.customers, []);
  const auth = readLocal(FILES.auth, {});

  let uid = explicitUid;
  if (!uid) {
    const existingAdmin = admins.find((a) => normalizeEmail(a.email) === email);
    const existingCustomer = customers.find((c) => normalizeEmail(c.email) === email);
    uid = existingAdmin?.uid || existingCustomer?.uid || newUid();
  }

  // العميل (الحساب الذي يسجّل الدخول)
  const cIdx = customers.findIndex((c) => c.uid === uid);
  if (cIdx >= 0) {
    customers[cIdx] = { ...customers[cIdx], email, name, emailVerified: true, updatedAt: now };
  } else {
    customers.push({
      uid,
      email,
      name,
      phone: "",
      city: "",
      address: "",
      emailVerified: true,
      disabled: false,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (password) auth[uid] = hashPassword(password);

  // سجل المدير
  const aIdx = admins.findIndex((a) => a.uid === uid);
  const doc = {
    uid,
    email,
    name,
    role,
    permissions,
    active,
    createdAt: aIdx >= 0 ? admins[aIdx].createdAt : now,
    lastLoginAt: aIdx >= 0 ? admins[aIdx].lastLoginAt : null,
  };
  if (aIdx >= 0) admins[aIdx] = { ...admins[aIdx], ...doc };
  else admins.push(doc);

  writeLocal(FILES.customers, customers);
  writeLocal(FILES.auth, auth);
  writeLocal(FILES.admins, admins);

  // منع تهيئة أول تشغيل من استبدال سجل المدراء
  const meta = readLocal(FILES.meta, { orderCounter: 0, idem: {}, seeded: false });
  writeLocal(FILES.meta, { ...meta, seeded: true });

  log(`تم في المحرّك المحلي ✓`);
  log(`  UID: ${uid}`);
  log(`  الدور: ${role}${role === "staff" ? ` | الصلاحيات: ${permissions.join(", ") || "لا شيء"}` : ""}`);
  log(`  الحالة: ${active ? "نشط" : "معطّل"}`);
  if (!password) log("  تنبيه: لم تُمرّر كلمة مرور (--password)؛ لن يتمكن الحساب من الدخول حتى تُضاف كلمة مرور.");
  log(`  الدخول من: /admin/login`);
}

async function runFirebase() {
  const { auth, db } = await getFirebaseAdmin();
  let user;
  try {
    user = await auth.getUserByEmail(email);
    if (password) await auth.updateUser(user.uid, { password, displayName: name, emailVerified: true });
    log(`مستخدم Firebase موجود بالفعل: ${user.uid}`);
  } catch {
    if (!password) fail("الحساب غير موجود في Firebase ويجب تمرير --password لإنشائه.");
    user = await auth.createUser({ email, password, displayName: name, emailVerified: true });
    log(`تم إنشاء مستخدم Firebase: ${user.uid}`);
  }

  const now = Date.now();
  const adminRef = db.collection("admins").doc(user.uid);
  const existing = await adminRef.get();
  await adminRef.set(
    {
      uid: user.uid,
      email,
      name,
      role,
      permissions,
      active,
      createdAt: existing.exists ? existing.data().createdAt || now : now,
      lastLoginAt: existing.exists ? existing.data().lastLoginAt ?? null : null,
    },
    { merge: true }
  );

  const customerRef = db.collection("customers").doc(user.uid);
  const customer = await customerRef.get();
  await customerRef.set(
    {
      uid: user.uid,
      email,
      name,
      phone: customer.exists ? customer.data().phone || "" : "",
      city: customer.exists ? customer.data().city || "" : "",
      address: customer.exists ? customer.data().address || "" : "",
      emailVerified: true,
      disabled: customer.exists ? Boolean(customer.data().disabled) : false,
      createdAt: customer.exists ? customer.data().createdAt || now : now,
      updatedAt: now,
    },
    { merge: true }
  );

  log(`تم في Firebase ✓`);
  log(`  UID: ${user.uid}`);
  log(`  الدور: ${role}${role === "staff" ? ` | الصلاحيات: ${permissions.join(", ") || "لا شيء"}` : ""}`);
  log(`  الدخول من: /admin/login`);
}

const driver = driverName();
log(`محرّك التخزين: ${driver}`);
if (driver === "firebase") await runFirebase();
else await runLocal();
