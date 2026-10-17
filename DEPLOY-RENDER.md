# نشر VELUNORA على Render.com — خطوة بخطوة

## تصوير سريع
- المنصة: [render.com](https://render.com) — بتبني المشروع من مستودع GitHub تلقائيًا.
- الملفات الجاهزة: `Dockerfile` + `render.yaml` (المستودع يحتويها بالفعل).
- مخزّن البيانات: **local** مع قرص دائم (Disk) موصول على `/app/var`.

> الخطة المجانية في Render **بدون قرص دائم** → البيانات (الطلبات/العملاء/الصور) تُمسح عند إعادة النشر.
> لذلك هذه الخطة على `starter` (الحد الأدنى المايد) الذي يتيح القرص الدائم. لو أردت الخطة المجانية
> امنح `STORAGE_DRIVER=firebase` بدلًا منها (يتطلب Firebase) — القسم 5 من الـ README.

---

## الخطوات

1. **أنشئ حسابًا مجانيًا** على [render.com](https://render.com) (يمكن الدخول بجوجل).
2. من لوحة Render: **New → Blueprint**.
3. اربط مستودع GitHub الخاص بك (`shoumanahmed70-sudo/velunora`) وامنح الإذن.
4. Render سيقرأ `render.yaml` تلقائيًا — راجع الإعدادات المطروحة ثم اضغط **Apply**.
5. بعد أول بناء: من خدمة **velunora** إذهب إلى **Environment** وأضف قيمًا:
   - `SESSION_SECRET` — إنشئ قيمة عشوائية طويلة (Render قد يولّد لك تلقائيًا "generateValue").
   - `APP_URL` — ضع الرابط النهائي للخدمة (مثال: `https://velunora-onrender.onrender.com`).
   - `SETTINGS_ENCRYPTION_KEY` — إنشئ بصيغة: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - `NEXT_PUBLIC_ALLOW_DEV_RESET_LINKS=false` (والبديل الجيد `VELUNORA_DEV_RESET_LINKS=false`).
6. اضغط **Manual Deploy → Deploy latest commit** ليعيد بناء الخدمة بعد ضبط المتغيرات.
7. عند نجاح النشر: افتح رابط الخدمة واضح أن المتجر يعمل. اربط النطاق المخصص اختياريًا من **Settings → Custom Domain**.

## بعد النشر — مهم
- **إدارة الأَدمن**: سجل الدخول من `/admin/login`.
- أو أنشئ حساب أدمن جديدًا عبر **Shell** في Render (من صفحة الخدمة → Shell):
  ```bash
  npm run admin:create -- --email owner@example.com --password "كلمة_مرور_قوية" --name "المالك" --role owner
  ```
- **النسخ الاحتياطي**: الضغط على القرص `/app/var` يحوي `var/db` + `var/uploads` — استخدم **Snapshots** أو المجدول `npm run db:backup`.

## سيران أخطاء محتملة
- **البناء يفشل على sharp**: تأكد أن `Dockerfile` على المرحلة `builder` يثبّت `python3 make g++` (موجودة بالفعل).
- **"APP_URL إلزامي"**: تأكد من إضافة `APP_URL` في Environment قبل النشر النهائي.
- **ذاكرة، لأن الاسم قد يكون عامًا**: إتّجه `render.yaml` لدينا `plan: starter` ليعمل القرص.

---
آخر تحديث لهذا الدليل: 2026-10-17
