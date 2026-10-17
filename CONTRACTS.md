# VELUNORA — مستند العقود (CONTRACTS)

> مرجع إلزامي لجميع المطورين. أي كود يجب أن يطابق هذا المستند حرفيًا.
> الأنواع: `@/lib/types` — القاموس: `@/lib/i18n/dict` (`useT()` من `@/lib/i18n/provider`).

## 1. ملكية الملفات (لا يمس أي مطور ملفات خارج نطاقه)

| المسؤول | النطاق |
|---|---|
| **المحرك (lead)** | `src/lib/**`، `src/app/api/**`، `src/app/layout.tsx`، `src/app/not-found.tsx`، `middleware.ts`، `scripts/**`، `*.rules`، `README.md` |
| **واجهة المتجر (A)** | `src/app/(shop)/**`، `src/components/shop/**` |
| **الإدارة الأساسية (B)** | `src/app/admin/layout.tsx`، `src/app/admin/page.tsx`، `src/app/admin/login/**`، `src/app/admin/products/**`، `src/app/admin/orders/**`، `src/components/admin/**` |
| **الإدارة المتقدمة (C)** | `src/app/admin/customers/**`، `src/app/admin/settings/**`، `src/app/admin/homepage/**`، `src/app/admin/content/**`، `src/app/admin/categories/**`، `src/app/admin/staff/**`، `src/app/admin/audit/**` |

يُمنع منعًا باتًا تعديل ملفات مطوّر آخر؛ إن احتاج تعديلًا في ملف مشترك فيراجع المحرك.

## 2. نظام التصميم (globals.css)

- ألوان عبر utility مولّدة: `bg-primary text-primary bg-gold text-gold bg-cream bg-bg text-ink text-muted border-line`.
- فئات جاهزة: `.btn .btn-primary .btn-gold .btn-outline .btn-ghost .field .field-label .card-lux .chip .display .text-gold-gradient .reveal .spinner`.
- خطوط: `--font-body` (Cairo) للنصوص، `--font-display` (Cormorant Garamond) للعناوين الكبيرة عبر فئة `.display`.
- `html[dir=rtl]` هو الوضع الافتراضي. استخدم منطق directional primitives: `ms-*/me-*`, `ps-*/pe-*`, `start-0/end-0`, `text-start/text-end` — ولا تستخدم `ml-/mr-/pl-/pr-/left-/right-` إلا للاتجاه المطلق.
- الانتقالات: `transition-all duration-300` مع `ease-luxe`. الفخامة = مساحات بيضاء واسعة، حدود رقيقة، ظلال ناعمة.
- أزرار كبيرة على الجوال: `min-h-11`.

## 3. عقد الـ API (كل الاستجابات JSON؛ الخطأ: `{ error: string, code?: string }` بحالة مناسبة)

مفتاح `code` المحتمل: `unauthorized | forbidden | not_found | validation | stock | duplicate | orders_paused | email_exists | invalid_credentials | weak_password | invalid_token | email_exists`.

### عام
- `GET /api/store` → `{ settings: StoreSettings, home: HomeSettings, categories: Category[], contactWaUrl: string }`
- `GET /api/products?category=&tag=(new|sale)&featured=1&q=&sort=(newest|price_asc|price_desc|featured)&limit=&cursor=` → `{ items: Product[], nextCursor: string | null }`
- `GET /api/products/[idOrSlug]` → `{ product: Product }`
- `POST /api/orders` `{ items: CartLine[], customer: OrderCustomer, idempotencyKey: string }` → `{ order: Order, waUrl: string, waMessage: string }`
- `POST /api/orders/lookup` `{ number, phone }` → `{ order: Order }`
- `GET /api/reviews?productId=` → `{ items: Review[] }` — `POST /api/reviews` `{ productId, rating: 1..5, comment }` (مطلوب تسجيل الدخول + شراء موثّق) → `{ review: Review }`
- `GET /api/pages/[slug]` → `{ page: PageDoc }`

### المصادقة (كوكي HttpOnly باسم `vn_session`)
- `POST /api/auth/register` `{ name, email, password, phone? }` → `{ ok: true }` (يسجّل الدخول تلقائيًا)
- `POST /api/auth/login` `{ email, password }` → `{ ok: true }`
- `POST /api/auth/logout` → `{ ok: true }`
- `GET /api/auth/me` → `MeResponse`
- `POST /api/auth/forgot` `{ email }` → `{ ok: true, devResetLink?: string }` (الرابط يظهر فقط في وضع التطوير)
- `POST /api/auth/reset` `{ token, password }` → `{ ok: true }`
- `POST /api/auth/verify` `{ token }` → `{ ok: true }`
- `POST /api/auth/resend-verification` → `{ ok: true, devVerifyLink?: string }`
- `POST /api/auth/google` `{ idToken }` → `{ ok: true }` (يستخدم فقط مع Firebase)

### الحساب (كوكي الجلسة إلزامي)
- `GET /api/account` → `{ profile: CustomerProfile }` — `PUT /api/account` `{ name?, phone?, city?, address? }` → `{ profile }`
- `GET /api/account/cart` → `{ lines: CartLine[] }` — `PUT /api/account/cart` `{ lines }` → `{ ok: true }`
- `GET /api/account/orders` → `{ orders: Order[] }`
- `GET /api/account/orders/[number]` → `{ order: Order }`

### الإدارة (جلسة + دور admin نشط؛ يُرفض 403 وإلا)
- `GET /api/admin/stats` → `{ totals: { orders, customers, products, revenue }, statusCounts: Record<OrderStatus, number>, recentOrders: Order[] }`
- `GET /api/admin/products?q=` → `{ items: Product[] }` — `POST /api/admin/products` → `{ product }`
- `GET|PUT|DELETE /api/admin/products/[id]` → `{ product }` / `{ ok: true }`
- `POST /api/admin/upload` (multipart: `files` متعدد، `kind=product|banner|logo|banner_home`) → `{ urls: string[] }`
- `DELETE /api/admin/upload?url=<مطلق>` → `{ ok: true }`
- `GET /api/admin/orders?status=&q=&page=&pageSize=` → `{ items: Order[], total, page, pageSize }`
- `GET /api/admin/orders/[id]` → `{ order }` — `PUT /api/admin/orders/[id]` `{ status?, internalNotes? }` → `{ order }`
- `GET /api/admin/orders/export?format=csv` → ملف CSV (يُصدَّر بالعربية مع BOM)
- `GET /api/admin/customers?q=&page=` → `{ items: (CustomerProfile & { orderCount: number })[], total, page, pageSize }`
- `GET /api/admin/customers/[uid]` → `{ profile, orders }` — `PUT /api/admin/customers/[uid]` `{ disabled: boolean }` → `{ profile }`
- `GET|PUT /api/admin/settings` → `{ settings }` — `GET|PUT /api/admin/settings/private` (owner فقط) → `{ private: PrivateSettings }`
- `GET|PUT /api/admin/home` → `{ home: HomeSettings }`
- `GET /api/admin/pages` → `{ items }` — `GET|PUT /api/admin/pages/[slug]` → `{ page }`
- `GET|POST /api/admin/categories` — `PUT|DELETE /api/admin/categories/[id]`
- `GET /api/admin/audit` → `{ items: AuditEntry[] }`
- `GET|POST /api/admin/staff` — `PUT|DELETE /api/admin/staff/[uid]` (owner فقط)

## 4. دوال القراءة من الخادم (SSR — تُستدعى في Server Components فقط)

```ts
import {
  getPublicStore, getSettings, getHome, getCategories,
  listProducts, getProduct, getPage, listReviews,
} from "@/lib/server/catalog";
```
- `getPublicStore(): Promise<{ settings, home, categories, contactWaUrl }>`
- `listProducts(q: { category?, tag?, featured?, q?, sort?, limit?, cursor? }): Promise<{ items: Product[]; nextCursor: string | null }>`
- `getProduct(idOrSlug): Promise<Product | null>`
- `getPage(slug): Promise<PageDoc | null>`
- `listReviews(productId): Promise<Review[]>`
- كلها تتعامل مع `notFound()` في مستوى الصفحة.

## 5. مزوّدات الحالة (موجودة في `src/app/layout.tsx` — تُغلف بها كل الصفحات)

```ts
import { useLang, useT } from "@/lib/i18n/provider"; // { lang: "ar"|"en", setLang, t: (k: TKey)=>string, dir }
import { useStore } from "@/lib/store-provider";      // { settings: StoreSettings, home: HomeSettings, categories, contactWaUrl }
import { useMe } from "@/lib/auth-provider";          // { me: MeResponse, refresh(), logout() }
import { useCart } from "@/lib/cart-provider";        // { lines, add(line), setQty, remove, clear, count, subtotal? }
```
ملاحظات:
- `useStore()` يجلب `/api/store` مرة واحدة ويوفر `loading`.
- `useCart()` يخزّن في localStorage، ويُزامن مع `/api/account/cart` عند تسجيل الدخول (دمج السلتين).
- `useMe()` يجلب `/api/auth/me`.
- استخدم `useApi()` من `@/lib/api-client`: `const api = useApi(); await api.post<T>("/api/…", body)` يرمي `ApiError` فيها `message` و`code` و`isNetwork`.

## 6. قواعد تجارية (لا تخترِع حسابات)

- الأسعار والخصومات والشحن والضريبة تُحسب **على الخادم** دائمًا؛ ما يأتي من العميل هو `(productId, variantId, options, qty)` فقط.
- زر واتساب لا يُظهر الرقم؛ يفتح `waUrl` يعيده الخادم.
- بعد إتمام الطلب: خزّن `vn_last_order = { number, phone }` في localStorage ثم انتقل إلى `/order/confirmation`.
- صفحة التأكيد تجلب الطلب عبر `POST /api/orders/lookup` وتعلّم العميل صراحة أن عليه الضغط على «إرسال» داخل واتساب.
- حالات الطلب: استخدم `ORDER_STATUSES` من `@/lib/types` وتسميات `status_new … status_cancelled` من القاموس.
- العملة: `settings.currencySymbol` + `settings.currency`.
- تنسيق المبالغ: استخدم `formatMoney(n, settings)` من `@/lib/money`.

## 7. مخطط بيانات Firestore (للمعرفة العامة)

`products/{id}` · `categories/{id}` · `orders/{id}` · `customers/{uid}` · `carts/{uid}` ·
`settings/store` · `settings/private` · `settings/home` · `pages/{slug}` · `reviews/{id}` ·
`admins/{uid}` · `audit/{id}` · `counters/orders` · `tokens/{kind}_{hash}`.
المحرك المحلي يحاكي هذا المخطط في `var/db/*.json`.

## 8. تحديثات وملفات مشتركة إضافية (ملكية المحرك)

- `/api/store` يعيد كذلك: `googleAuthEnabled: boolean` و`firebaseConfig: object | null` (مفاتيح الويب العامة فقط).
- `useStore()` يوفّر هذه الحقول كما هي. `useToast()` من `@/lib/toast`: `toast(msg, "success"|"error"|"info")`.
- `@/lib/order-status`: `STATUS_LABELS` (تسميات عربية) و`STATUS_STYLES` (فئات ألوان) و`REVIEWABLE_STATUSES`.
- `@/lib/google-auth`: `googleSignIn(): Promise<void>` (تجاهل إن لم يكن Google مفعّلًا).
- `@/lib/server/guard` (خادم فقط): `getSessionUser()`, `requireAdminPage(permission?)`, `requireAdminApi(permission?)`, `requireUserApi()`.
  - `requireAdminPage` تُستدعى في تخطيط الإدارة وتوجّه تلقائيًا إلى `/admin/login` عند انعدام الصلاحية.
  - الصلاحيات: `products | orders | customers | settings | home | pages | audit` — و`owner` يملك الكل.
- `@/components/admin/ui` (ملكية المحرك — يُستخدم في كل صفحات الإدارة ولا يُعدّل):
  `AdminHeading`, `Panel`, `Field`, `Toggle`, `StatusBadge`, `Modal`, `ConfirmDialog`,
  `TableWrap`, `Th`, `Td`, `Pagination`, `EmptyRow`, `LoadingBlock`, `ErrorBlock`,
  `ImageUploader({ value, onChange, kind, multiple, label, hint })`, `SavedFlash`, `inputCls`.
- مسارات الإدارة للطلبات تعيد `waUrl` مبنية على الخادم: عناصر `GET /api/admin/orders` هي `Order & { waUrl: string }`،
  و`GET|PUT /api/admin/orders/[id]` يعيدان `{ order, waUrl, waMessage }`.
- رسائل الأخطاء في الواجهة: استخدم `errorMessage(err)` من `@/lib/api-client`.
