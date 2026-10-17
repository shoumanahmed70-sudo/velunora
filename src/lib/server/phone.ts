import "server-only";

/**
 * أدوات تطبيق ومطابقة أرقام الجوال.
 *
 * تُستخدم في تتبّع الطلبات وإرسال الفاتورة اتّساقًا في كل المسارات.
 */

/** تطبيع رقم الجوال: أرقام فقط، مع إزالة البادئة الدولية 00. */
export function normalizePhone(value: string): string {
  let digits = (value || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  return digits;
}

/**
 * مطابقة رقم الجوال مع رقم الطلب.
 *
 * - المطابقة **الكاملة** بعد التطبيع هي الأساس (وليس آخر 9 أرقام كما كان سابقًا).
 * - نسمح باستثناء واحد فقط: اختلاف رمز الدولة أو الصفر البادئ، فيُقبل تطابق آخر
 *   9 أرقام **بشرط** أن يكون الطرفان 9 أرقام على الأقل. هذا يمنع الحالة القديمة
 *   التي كان فيها رقم قصير (٣ أرقام مثلًا) يطابق أي طلب.
 */
export function phonesMatch(stored: string, input: string): boolean {
  const a = normalizePhone(stored);
  const b = normalizePhone(input);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length < 9 || b.length < 9) return false;
  return a.slice(-9) === b.slice(-9);
}
