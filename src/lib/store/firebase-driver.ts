import "server-only";

import crypto from "node:crypto";
import type {
  AdminDoc,
  AuditEntry,
  CartLine,
  Category,
  CustomerProfile,
  HomeSettings,
  Order,
  OrderItem,
  PageDoc,
  PrivateSettings,
  Product,
  Review,
  StoreSettings,
} from "@/lib/types";
import type {
  CreateOrderInput,
  CreateOrderResult,
  CustomerQuery,
  OrderQuery,
  ProductQuery,
  StoreDriver,
} from "@/lib/store/driver";
import {
  defaultCategories,
  defaultHome,
  defaultPages,
  defaultPrivateSettings,
  defaultSettings,
} from "@/lib/store/defaults";
import { assertMinOrder, buildOrderItem, computeTotals, PricingError, round2 } from "@/lib/server/pricing";
import { getFirebaseAdmin } from "@/lib/server/firebase-admin";

/**
 * محرّك Firebase (الإنتاج): Firestore + Cloud Storage + Firebase Authentication.
 * - كل العمليات الحسّاسة داخل معاملة (Transaction).
 * - لا يُقرأ أي سعر أو صلاحية من العميل.
 * - صلاحية المدير تُقرأ من سجل admins على الخادم وتُطابق نسخة Custom Claims.
 */

const C = {
  products: "products",
  categories: "categories",
  orders: "orders",
  customers: "customers",
  carts: "carts",
  pages: "pages",
  reviews: "reviews",
  admins: "admins",
  audit: "audit",
  tokens: "tokens",
  idem: "idem",
  settingsStore: "settings/store",
  settingsPrivate: "settings/private",
  settingsHome: "settings/home",
  counter: "counters/orders",
} as const;

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function slugify(value: string): string {
  const base = (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${crypto.randomUUID().slice(0, 6)}`;
}

function normalizeText(value: string): string {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u0652\u0640]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\s+/g, " ");
}

function effectivePrice(p: Product): number {
  if (p.variants?.length) return Math.min(...p.variants.map((v) => v.price));
  return p.price;
}

export class FirebaseDriver implements StoreDriver {
  private admin = getFirebaseAdmin();
  private db = this.admin.db();

  private async seeded<T>(ref: string, fallback: T): Promise<T> {
    const snap = await this.db.doc(ref).get();
    if (snap.exists) return snap.data() as T;
    await this.db.doc(ref).set(fallback as object, { merge: true });
    return fallback;
  }

  // ---------------- المنتجات ----------------
  private async fetchProducts(includeInactive = false, category?: string): Promise<Product[]> {
    let query = this.db.collection(C.products).where("active", "==", true);
    if (includeInactive) query = this.db.collection(C.products) as never;
    if (category) query = query.where("category", "==", category);
    const snap = await query.limit(500).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) }));
  }

  async listProducts(q: ProductQuery): Promise<{ items: Product[]; nextCursor: string | null }> {
    let list = await this.fetchProducts(Boolean(q.includeInactive), q.category);
    if (q.category) list = list.filter((p) => p.category === q.category);
    if (q.featured) list = list.filter((p) => p.featured);
    if (q.tag === "new") list = list.filter((p) => p.isNew);
    if (q.tag === "sale") list = list.filter((p) => p.onSale || (p.compareAtPrice ?? 0) > p.price);

    if (q.q) {
      const needle = normalizeText(q.q);
      list = list.filter((p) =>
        normalizeText([p.name, p.nameEn, p.description, p.descriptionEn].filter(Boolean).join(" ")).includes(needle)
      );
    }

    switch (q.sort) {
      case "price_asc":
        list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
        break;
      case "price_desc":
        list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
        break;
      case "featured":
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order || b.createdAt - a.createdAt);
        break;
      default:
        list.sort((a, b) => b.createdAt - a.createdAt);
    }

    const limit = Math.min(Math.max(q.limit ?? 24, 1), 60);
    const offset = Math.max(Number(q.cursor ?? 0) || 0, 0);
    const items = list.slice(offset, offset + limit);
    return { items, nextCursor: offset + limit < list.length ? String(offset + limit) : null };
  }

  async getProduct(id: string): Promise<Product | null> {
    const snap = await this.db.collection(C.products).doc(id).get();
    return snap.exists ? ({ id: snap.id, ...(snap.data() as Omit<Product, "id">) } as Product) : null;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const snap = await this.db.collection(C.products).where("slug", "==", slug).limit(1).get();
    if (snap.empty) return null;
    const doc = snap.docs[0];
    return { id: doc.id, ...(doc.data() as Omit<Product, "id">) } as Product;
  }

  async createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
    const now = Date.now();
    const id = newId("prd");
    let slug = slugify(data.slug || data.name);
    const clash = await this.db.collection(C.products).where("slug", "==", slug).limit(1).get();
    if (!clash.empty) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
    const product: Product = { ...data, id, slug, createdAt: now, updatedAt: now };
    if (!product.images?.length) product.images = ["/brand/placeholder.svg"];
    await this.db.collection(C.products).doc(id).set(product);
    return product;
  }

  async updateProduct(id: string, patch: Partial<Omit<Product, "id">>): Promise<Product> {
    const ref = this.db.collection(C.products).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new PricingError("المنتج غير موجود", "not_found");
    const next: Product = { ...(snap.data() as Product), ...patch, id, updatedAt: Date.now() };
    if (patch.slug) {
      const slug = slugify(patch.slug);
      const clash = await this.db.collection(C.products).where("slug", "==", slug).limit(2).get();
      const taken = clash.docs.some((d) => d.id !== id);
      next.slug = taken ? `${slug}-${crypto.randomUUID().slice(0, 4)}` : slug;
    }
    await ref.set(next, { merge: false });
    return next;
  }

  async deleteProduct(id: string): Promise<void> {
    await this.db.collection(C.products).doc(id).delete();
  }

  // ---------------- التصنيفات ----------------
  async listCategories(): Promise<Category[]> {
    const snap = await this.db.collection(C.categories).get();
    if (snap.empty) {
      for (const category of defaultCategories()) await this.db.collection(C.categories).doc(category.id).set(category);
      return defaultCategories();
    }
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<Category, "id">) }))
      .sort((a, b) => a.order - b.order);
  }

  async saveCategory(c: Category): Promise<Category> {
    const id = c.id || slugify(c.slug || c.name);
    const record: Category = { ...c, id };
    await this.db.collection(C.categories).doc(id).set(record, { merge: true });
    return record;
  }

  async deleteCategory(id: string): Promise<void> {
    await this.db.collection(C.categories).doc(id).delete();
  }

  // ---------------- الطلبات ----------------
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    const settings = await this.getSettings();
    if (!settings.ordersEnabled) throw new PricingError("الطلبات متوقفة حاليًا", "orders_paused");
    if (!input.items?.length) throw new PricingError("السلة فارغة", "validation");

    const counterRef = this.db.doc(C.counter);
    const idemRef = this.db.doc(`${C.idem}/${input.idempotencyKey}`);
    const orderRef = this.db.collection(C.orders).doc();

    let created: Order | null = null;
    let duplicateId: string | null = null;

    await this.db.runTransaction(async (tx) => {
      const idemSnap = await tx.get(idemRef);
      if (idemSnap.exists) {
        duplicateId = String((idemSnap.data() as { orderId?: string }).orderId || "");
        return;
      }

      const counterSnap = await tx.get(counterRef);
      const counter = Number((counterSnap.data() as { value?: number } | undefined)?.value || 0) + 1;

      const productRefs = input.items.map((line) => this.db.collection(C.products).doc(line.productId));
      const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

      const items: OrderItem[] = [];
      const nextStocks: Array<{ ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }> = [];

      productSnaps.forEach((snap, index) => {
        const line = input.items[index];
        if (!snap.exists) throw new PricingError("أحد المنتجات لم يعد متوفرًا", "validation");
        const product = { id: snap.id, ...(snap.data() as Omit<Product, "id">) } as Product;
        if (!product.active) throw new PricingError("أحد المنتجات غير متوفر حاليًا", "validation");

        const item = buildOrderItem(product, line.variantId, line.options || {}, line.qty);
        items.push(item);

        if (item.variantId) {
          const variants = product.variants.map((v) =>
            v.id === item.variantId ? { ...v, stock: Math.max(0, v.stock - item.qty) } : v
          );
          nextStocks.push({
            ref: productRefs[index],
            data: { variants, stock: variants.reduce((s, v) => s + v.stock, 0), updatedAt: Date.now() },
          });
        } else {
          nextStocks.push({
            ref: productRefs[index],
            data: { stock: Math.max(0, product.stock - item.qty), updatedAt: Date.now() },
          });
        }
      });

      assertMinOrder(items, settings);
      const totals = computeTotals(items, settings);
      const now = Date.now();

      const order: Order = {
        id: orderRef.id,
        number: `VN-${1000 + counter}`,
        uid: input.uid ?? null,
        customer: input.customer,
        items,
        subtotal: totals.subtotal,
        discount: totals.discount,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
        currency: settings.currency,
        status: "new",
        internalNotes: "",
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
        updatedAt: now,
        statusUpdatedAt: null,
      };

      tx.set(orderRef, order);
      tx.set(counterRef, { value: counter }, { merge: true });
      tx.set(idemRef, { orderId: orderRef.id, createdAt: now });
      for (const stock of nextStocks) tx.update(stock.ref, stock.data);
      created = order;
    });

    if (created) return { order: created as Order, duplicate: false };

    const existing = duplicateId ? await this.getOrder(String(duplicateId)) : null;
    if (existing) return { order: existing, duplicate: true };
    throw new PricingError("تعذّر إنشاء الطلب، أعد المحاولة", "validation");
  }

  async getOrder(id: string): Promise<Order | null> {
    const snap = await this.db.collection(C.orders).doc(id).get();
    return snap.exists ? (snap.data() as Order) : null;
  }

  async getOrderByNumber(number: string): Promise<Order | null> {
    const snap = await this.db
      .collection(C.orders)
      .where("number", "==", number.trim().toUpperCase())
      .limit(1)
      .get();
    if (snap.empty) return null;
    return snap.docs[0].data() as Order;
  }

  async listOrders(q: OrderQuery): Promise<{ items: Order[]; total: number }> {
    let query = this.db.collection(C.orders).orderBy("createdAt", "desc").limit(1000);
    if (q.status && q.status !== "all") {
      query = this.db
        .collection(C.orders)
        .where("status", "==", q.status)
        .orderBy("createdAt", "desc")
        .limit(1000);
    }
    const snap = await query.get();
    let list = snap.docs.map((d) => d.data() as Order);

    if (q.q) {
      const needle = normalizeText(q.q);
      const digits = q.q.replace(/\D/g, "");
      list = list.filter((o) => {
        const haystack = normalizeText([o.number, o.customer.name, o.customer.city, o.customer.email ?? ""].join(" "));
        return haystack.includes(needle) || (digits.length > 3 && o.customer.phone.includes(digits));
      });
    }

    const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    return { items: list.slice((page - 1) * pageSize, page * pageSize), total: list.length };
  }

  async updateOrder(id: string, patch: { status?: Order["status"]; internalNotes?: string }): Promise<Order> {
    const ref = this.db.collection(C.orders).doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new PricingError("الطلب غير موجود", "not_found");
    const current = snap.data() as Order;
    const next: Partial<Order> = { updatedAt: Date.now() };
    if (patch.status && patch.status !== current.status) {
      next.status = patch.status;
      next.statusUpdatedAt = Date.now();
    }
    if (typeof patch.internalNotes === "string") next.internalNotes = patch.internalNotes.slice(0, 2000);
    await ref.set(next, { merge: true });
    const updated = await ref.get();
    return updated.data() as Order;
  }

  async listCustomerOrders(uid: string): Promise<Order[]> {
    const snap = await this.db.collection(C.orders).where("uid", "==", uid).limit(200).get();
    return snap.docs.map((d) => d.data() as Order).sort((a, b) => b.createdAt - a.createdAt);
  }

  async countCustomerOrders(uid: string): Promise<number> {
    const snap = await this.db.collection(C.orders).where("uid", "==", uid).count().get();
    return snap.data().count;
  }

  // ---------------- العملاء ----------------
  async getCustomer(uid: string): Promise<CustomerProfile | null> {
    const snap = await this.db.collection(C.customers).doc(uid).get();
    return snap.exists ? (snap.data() as CustomerProfile) : null;
  }

  async getCustomerByEmail(email: string): Promise<CustomerProfile | null> {
    const clean = (email || "").trim().toLowerCase();
    if (!clean) return null;
    const snap = await this.db.collection(C.customers).where("email", "==", clean).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as CustomerProfile;
  }

  async upsertCustomer(profile: CustomerProfile): Promise<CustomerProfile> {
    const record = { ...profile, updatedAt: Date.now() };
    await this.db.collection(C.customers).doc(profile.uid).set(record, { merge: true });
    return record;
  }

  async listCustomers(q: CustomerQuery): Promise<{
    items: (CustomerProfile & { orderCount: number })[];
    total: number;
  }> {
    const snap = await this.db.collection(C.customers).orderBy("createdAt", "desc").limit(1000).get();
    let list = snap.docs.map((d) => d.data() as CustomerProfile);
    if (q.q) {
      const needle = normalizeText(q.q);
      const digits = q.q.replace(/\D/g, "");
      list = list.filter((c) => {
        const haystack = normalizeText([c.name, c.email, c.city, c.phone].join(" "));
        return haystack.includes(needle) || (digits.length > 3 && c.phone.includes(digits));
      });
    }
    const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    const slice = list.slice((page - 1) * pageSize, page * pageSize);
    const items = await Promise.all(
      slice.map(async (c) => ({ ...c, orderCount: await this.countCustomerOrders(c.uid) }))
    );
    return { items, total: list.length };
  }

  async setCustomerDisabled(uid: string, disabled: boolean): Promise<CustomerProfile> {
    const ref = this.db.collection(C.customers).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new PricingError("العميل غير موجود", "not_found");
    await ref.set({ disabled, updatedAt: Date.now() }, { merge: true });
    const updated = await ref.get();
    return updated.data() as CustomerProfile;
  }

  // ---------------- المصادقة (يديرها Firebase) ----------------
  async saveAuthSecret(): Promise<void> {
    throw new Error("كلمات المرور في وضع Firebase تُدار عبر Firebase Authentication");
  }

  async getAuthSecret(): Promise<string | null> {
    return null;
  }

  // ---------------- السلة ----------------
  async getCart(uid: string): Promise<CartLine[]> {
    const snap = await this.db.collection(C.carts).doc(uid).get();
    const data = snap.data() as { lines?: CartLine[] } | undefined;
    return Array.isArray(data?.lines) ? (data?.lines as CartLine[]) : [];
  }

  async setCart(uid: string, lines: CartLine[]): Promise<void> {
    await this.db.collection(C.carts).doc(uid).set({ lines: (lines || []).slice(0, 60), updatedAt: Date.now() });
  }

  // ---------------- الإعدادات ----------------
  async getSettings(): Promise<StoreSettings> {
    const snap = await this.db.doc(C.settingsStore).get();
    if (!snap.exists) {
      const settings = defaultSettings();
      await this.db.doc(C.settingsStore).set(settings);
      return settings;
    }
    return { ...defaultSettings(), ...(snap.data() as Partial<StoreSettings>) } as StoreSettings;
  }

  async saveSettings(s: StoreSettings): Promise<void> {
    await this.db.doc(C.settingsStore).set(s);
  }

  async getPrivateSettings(): Promise<PrivateSettings> {
    const snap = await this.db.doc(C.settingsPrivate).get();
    if (!snap.exists) {
      const priv = defaultPrivateSettings();
      await this.db.doc(C.settingsPrivate).set(priv);
      return priv as PrivateSettings;
    }
    const data = snap.data() as Partial<PrivateSettings>;
    return { ...defaultPrivateSettings(), ...data, smtp: { ...defaultPrivateSettings().smtp, ...(data.smtp || {}) } } as PrivateSettings;
  }

  async savePrivateSettings(p: PrivateSettings): Promise<void> {
    await this.db.doc(C.settingsPrivate).set(p);
  }

  async getHome(): Promise<HomeSettings> {
    const snap = await this.db.doc(C.settingsHome).get();
    if (!snap.exists) {
      const home = defaultHome();
      await this.db.doc(C.settingsHome).set(home);
      return home;
    }
    return { ...defaultHome(), ...(snap.data() as Partial<HomeSettings>) } as HomeSettings;
  }

  async saveHome(h: HomeSettings): Promise<void> {
    await this.db.doc(C.settingsHome).set(h);
  }

  // ---------------- الصفحات ----------------
  async listPages(): Promise<PageDoc[]> {
    const snap = await this.db.collection(C.pages).get();
    if (snap.empty) {
      for (const page of defaultPages()) await this.db.collection(C.pages).doc(page.slug).set(page);
      return defaultPages();
    }
    return snap.docs.map((d) => d.data() as PageDoc).sort((a, b) => a.slug.localeCompare(b.slug));
  }

  async getPage(slug: string): Promise<PageDoc | null> {
    const snap = await this.db.collection(C.pages).doc(slug).get();
    if (snap.exists) return snap.data() as PageDoc;
    const fallback = defaultPages().find((p) => p.slug === slug);
    return fallback ?? null;
  }

  async savePage(p: PageDoc): Promise<PageDoc> {
    const record = { ...p, updatedAt: Date.now() };
    await this.db.collection(C.pages).doc(p.slug).set(record);
    return record;
  }

  // ---------------- التقييمات ----------------
  async listReviews(productId: string): Promise<Review[]> {
    const snap = await this.db
      .collection(C.reviews)
      .where("productId", "==", productId)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();
    return snap.docs.map((d) => d.data() as Review);
  }

  async createReview(r: Review): Promise<Review> {
    await this.db.collection(C.reviews).doc(r.id).set(r);
    return r;
  }

  // ---------------- المدراء ----------------
  async getAdminByUid(uid: string): Promise<AdminDoc | null> {
    const snap = await this.db.collection(C.admins).doc(uid).get();
    return snap.exists ? (snap.data() as AdminDoc) : null;
  }

  async getAdminByEmail(email: string): Promise<AdminDoc | null> {
    const clean = (email || "").trim().toLowerCase();
    const snap = await this.db.collection(C.admins).where("email", "==", clean).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].data() as AdminDoc;
  }

  async listAdmins(): Promise<AdminDoc[]> {
    const snap = await this.db.collection(C.admins).get();
    return snap.docs.map((d) => d.data() as AdminDoc);
  }

  async saveAdmin(a: AdminDoc): Promise<AdminDoc> {
    await this.db.collection(C.admins).doc(a.uid).set(a, { merge: true });
    return a;
  }

  async deleteAdmin(uid: string): Promise<void> {
    await this.db.collection(C.admins).doc(uid).delete();
  }

  // ---------------- سجل التدقيق ----------------
  async logAudit(entry: AuditEntry): Promise<void> {
    await this.db.collection(C.audit).doc(entry.id).set(entry);
  }

  async listAudit(limit = 200): Promise<AuditEntry[]> {
    const snap = await this.db.collection(C.audit).orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((d) => d.data() as AuditEntry);
  }

  // ---------------- الرموز (تُستخدم فقط في وضع Firebase للترقية/الاستخدام الداخلي) ----------------
  async saveToken(record: { key: string; uid: string; expiresAt: number }): Promise<void> {
    await this.db.collection(C.tokens).doc(record.key).set(record);
  }

  async consumeToken(key: string): Promise<{ uid: string } | null> {
    const ref = this.db.collection(C.tokens).doc(key);
    const snap = await ref.get();
    if (!snap.exists) return null;
    await ref.delete();
    const data = snap.data() as { uid: string; expiresAt: number };
    if (data.expiresAt < Date.now()) return null;
    return { uid: data.uid };
  }

  // ---------------- التخزين ----------------
  async saveUpload(bytes: Buffer, filename: string, kind: string): Promise<string> {
    const bucketName = this.admin.app.options.storageBucket;
    if (!bucketName) {
      throw new PricingError("لم يتم ضبط Cloud Storage bucket في إعدادات Firebase", "validation");
    }
    const bucket = this.admin.storage().bucket(bucketName);
    const safeKind = kind.replace(/[^a-z0-9_-]/gi, "") || "misc";
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const path = `velunora/${safeKind}/${safeName}`;
    const token = crypto.randomUUID();
    const file = bucket.file(path);

    await file.save(bytes, {
      contentType: "image/webp",
      resumable: false,
      metadata: {
        cacheControl: "public, max-age=31536000, immutable",
        metadata: { firebaseStorageDownloadTokens: token },
      },
    });

    return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  }

  async deleteUpload(url: string): Promise<void> {
    const bucketName = this.admin.app.options.storageBucket;
    if (!bucketName || !url.includes("firebasestorage.googleapis.com")) return;
    try {
      const match = url.match(/\/o\/([^?]+)/);
      if (!match) return;
      const path = decodeURIComponent(match[1]);
      await this.admin.storage().bucket(bucketName).file(path).delete({ ignoreNotFound: true });
    } catch {
      /* فشل حذف الملف لا يعطّل العمل */
    }
  }
}
