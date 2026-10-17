import "server-only";

import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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

/**
 * محرّك التخزين المحلي — للتطوير والاختبار والاستضافة الذاتية.
 * يحاكي مخطط Firestore في ملفات JSON داخل var/db مع قفل كتابة وحيد (معاملات مبسّطة).
 */

const DATA_DIR = process.env.VELUNORA_DATA_DIR || path.join(process.cwd(), "var", "db");
const UPLOAD_DIR = process.env.VELUNORA_UPLOAD_DIR || path.join(process.cwd(), "var", "uploads");

const FILES = {
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
} as const;

interface SettingsFile {
  store: StoreSettings;
  private: PrivateSettings;
  home: HomeSettings;
}

interface MetaFile {
  orderCounter: number;
  idem: Record<string, string>;
  seeded: boolean;
}

const cache = new Map<string, { mtime: number; data: unknown }>();

async function readJson<T>(file: string, fallback: T): Promise<T> {
  const full = path.join(DATA_DIR, file);
  try {
    const stat = await fs.stat(full);
    const hit = cache.get(full);
    if (hit && hit.mtime === stat.mtimeMs) return structuredClone(hit.data) as T;
    const raw = await fs.readFile(full, "utf8");
    const data = JSON.parse(raw);
    cache.set(full, { mtime: stat.mtimeMs, data });
    return structuredClone(data) as T;
  } catch {
    return structuredClone(fallback);
  }
}

async function writeJson(file: string, data: unknown): Promise<void> {
  const full = path.join(DATA_DIR, file);
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${full}.${randomUUID().slice(0, 8)}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, full).catch(async () => {
    // على Windows قد يفشل الاستبدال المباشر
    await fs.rm(full, { force: true });
    await fs.rename(tmp, full);
  });
  cache.delete(full);
}

// قفل كتابة وحيد لكل عمليات الكتابة/المعاملات
let chain: Promise<unknown> = Promise.resolve();
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
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
  if (p.variants.length) return Math.min(...p.variants.map((v) => v.price));
  return p.price;
}

function slugify(value: string): string {
  const base = (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return base || `item-${randomUUID().slice(0, 6)}`;
}

export class LocalDriver implements StoreDriver {
  /** تهيئة أول تشغيل: إعدادات وتصنيفات وصفحات افتراضية */
  private async ensureSeeded(): Promise<void> {
    const meta = await readJson<MetaFile>(FILES.meta, { orderCounter: 0, idem: {}, seeded: false });
    if (meta.seeded) return;
    await withLock(async () => {
      const current = await readJson<MetaFile>(FILES.meta, { orderCounter: 0, idem: {}, seeded: false });
      if (current.seeded) return;
      await writeJson(FILES.settings, {
        store: defaultSettings(),
        private: defaultPrivateSettings(),
        home: defaultHome(),
      } satisfies SettingsFile);
      await writeJson(FILES.categories, defaultCategories());
      await writeJson(FILES.pages, defaultPages());
      await writeJson(FILES.products, [] satisfies Product[]);
      await writeJson(FILES.orders, [] satisfies Order[]);
      await writeJson(FILES.customers, [] satisfies CustomerProfile[]);
      await writeJson(FILES.carts, {});
      await writeJson(FILES.reviews, [] satisfies Review[]);
      await writeJson(FILES.admins, [] satisfies AdminDoc[]);
      await writeJson(FILES.audit, [] satisfies AuditEntry[]);
      await writeJson(FILES.tokens, {});
      await writeJson(FILES.auth, {});
      await writeJson(FILES.meta, { orderCounter: 0, idem: {}, seeded: true } satisfies MetaFile);
    });
  }

  private async settings(): Promise<SettingsFile> {
    await this.ensureSeeded();
    return readJson<SettingsFile>(FILES.settings, {
      store: defaultSettings(),
      private: defaultPrivateSettings(),
      home: defaultHome(),
    });
  }

  // ---------------- المنتجات ----------------
  async listProducts(q: ProductQuery): Promise<{ items: Product[]; nextCursor: string | null }> {
    const all = await readJson<Product[]>(FILES.products, []);
    let list = all.filter((p) => (q.includeInactive ? true : p.active));

    if (q.category) list = list.filter((p) => p.category === q.category);
    if (q.featured) list = list.filter((p) => p.featured);
    if (q.tag === "new") list = list.filter((p) => p.isNew);
    if (q.tag === "sale") list = list.filter((p) => p.onSale || (p.compareAtPrice ?? 0) > p.price);

    if (q.q) {
      const needle = normalizeText(q.q);
      list = list.filter((p) => {
        const haystack = normalizeText(
          [p.name, p.nameEn, p.description, p.descriptionEn].filter(Boolean).join(" ")
        );
        return haystack.includes(needle);
      });
    }

    switch (q.sort) {
      case "price_asc":
        list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
        break;
      case "price_desc":
        list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
        break;
      case "featured":
        list.sort((a, b) => Number(b.featured) - Number(a.featured) || a.order - b.order);
        break;
      default:
        list.sort((a, b) => b.createdAt - a.createdAt);
    }

    const limit = Math.min(Math.max(q.limit ?? 24, 1), 60);
    const offset = Math.max(Number(q.cursor ?? 0) || 0, 0);
    const items = list.slice(offset, offset + limit);
    const next = offset + limit < list.length ? String(offset + limit) : null;
    return { items, nextCursor: next };
  }

  async getProduct(id: string): Promise<Product | null> {
    const all = await readJson<Product[]>(FILES.products, []);
    return all.find((p) => p.id === id) ?? null;
  }

  async getProductBySlug(slug: string): Promise<Product | null> {
    const all = await readJson<Product[]>(FILES.products, []);
    return all.find((p) => p.slug === slug) ?? null;
  }

  async createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product> {
    return withLock(async () => {
      const all = await readJson<Product[]>(FILES.products, []);
      const now = Date.now();
      let slug = slugify(data.slug || data.name);
      if (all.some((p) => p.slug === slug)) slug = `${slug}-${randomUUID().slice(0, 4)}`;
      const product: Product = { ...data, id: `prd_${randomUUID()}`, slug, createdAt: now, updatedAt: now };
      if (!product.images.length) product.images = ["/brand/placeholder.svg"];
      if (!product.variants.length && product.stock <= 0) product.stock = 1;
      all.push(product);
      await writeJson(FILES.products, all);
      return product;
    });
  }

  async updateProduct(id: string, patch: Partial<Omit<Product, "id">>): Promise<Product> {
    return withLock(async () => {
      const all = await readJson<Product[]>(FILES.products, []);
      const idx = all.findIndex((p) => p.id === id);
      if (idx < 0) throw new PricingError("المنتج غير موجود", "not_found");
      const next: Product = { ...all[idx], ...patch, id, updatedAt: Date.now() };
      if (patch.slug) {
        const slug = slugify(patch.slug);
        next.slug = all.some((p) => p.id !== id && p.slug === slug) ? `${slug}-${randomUUID().slice(0, 4)}` : slug;
      }
      all[idx] = next;
      await writeJson(FILES.products, all);
      return next;
    });
  }

  async deleteProduct(id: string): Promise<void> {
    await withLock(async () => {
      const all = await readJson<Product[]>(FILES.products, []);
      await writeJson(
        FILES.products,
        all.filter((p) => p.id !== id)
      );
    });
  }

  // ---------------- التصنيفات ----------------
  async listCategories(): Promise<Category[]> {
    await this.ensureSeeded();
    const all = await readJson<Category[]>(FILES.categories, defaultCategories());
    return all.sort((a, b) => a.order - b.order);
  }

  async saveCategory(c: Category): Promise<Category> {
    return withLock(async () => {
      const all = await readJson<Category[]>(FILES.categories, []);
      const idx = all.findIndex((x) => x.id === c.id);
      const record: Category = { ...c, id: c.id || slugify(c.slug || c.name) };
      if (idx >= 0) all[idx] = record;
      else all.push(record);
      await writeJson(FILES.categories, all);
      return record;
    });
  }

  async deleteCategory(id: string): Promise<void> {
    await withLock(async () => {
      const all = await readJson<Category[]>(FILES.categories, []);
      await writeJson(
        FILES.categories,
        all.filter((c) => c.id !== id)
      );
    });
  }

  // ---------------- الطلبات ----------------
  async createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
    return withLock(async () => {
      const meta = await readJson<MetaFile>(FILES.meta, { orderCounter: 0, idem: {}, seeded: false });
      const orders = await readJson<Order[]>(FILES.orders, []);

      // منع التكرار عبر مفتاح العميل
      const existingId = meta.idem[input.idempotencyKey];
      if (existingId) {
        const existing = orders.find((o) => o.id === existingId);
        if (existing) return { order: existing, duplicate: true };
      }

      const products = await readJson<Product[]>(FILES.products, []);
      const settings = (await this.settings()).store;

      if (!settings.ordersEnabled) throw new PricingError("الطلبات متوقفة حاليًا", "orders_paused");
      if (!input.items?.length) throw new PricingError("السلة فارغة", "validation");

      const items: OrderItem[] = [];
      for (const line of input.items) {
        const product = products.find((p) => p.id === line.productId);
        if (!product || !product.active) throw new PricingError("أحد المنتجات غير متوفر", "validation");
        items.push(buildOrderItem(product, line.variantId, line.options || {}, line.qty));
      }

      assertMinOrder(items, settings);
      const totals = computeTotals(items, settings);

      // خصم المخزون (تحقق مسبق كامل قبل أي كتابة)
      const updatedProducts = [...products];
      for (const item of items) {
        const idx = updatedProducts.findIndex((p) => p.id === item.productId);
        const product = { ...updatedProducts[idx] };
        if (item.variantId) {
          const variants = product.variants.map((v) =>
            v.id === item.variantId ? { ...v, stock: round2(v.stock - item.qty) } : v
          );
          product.variants = variants;
          product.stock = variants.reduce((s, v) => s + v.stock, 0);
        } else {
          product.stock = Math.max(0, product.stock - item.qty);
        }
        product.updatedAt = Date.now();
        updatedProducts[idx] = product;
      }

      const counter = (meta.orderCounter || 0) + 1;
      const now = Date.now();
      const order: Order = {
        id: `ord_${randomUUID()}`,
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

      orders.push(order);
      await writeJson(FILES.products, updatedProducts);
      await writeJson(FILES.orders, orders);
      await writeJson(FILES.meta, {
        ...meta,
        orderCounter: counter,
        idem: { ...meta.idem, [input.idempotencyKey]: order.id },
        seeded: true,
      });

      return { order, duplicate: false };
    });
  }

  async getOrder(id: string): Promise<Order | null> {
    const all = await readJson<Order[]>(FILES.orders, []);
    return all.find((o) => o.id === id) ?? null;
  }

  async getOrderByNumber(number: string): Promise<Order | null> {
    const all = await readJson<Order[]>(FILES.orders, []);
    const needle = number.trim().toUpperCase();
    return all.find((o) => o.number.toUpperCase() === needle) ?? null;
  }

  async listOrders(q: OrderQuery): Promise<{ items: Order[]; total: number }> {
    const all = await readJson<Order[]>(FILES.orders, []);
    let list = [...all];
    if (q.status && q.status !== "all") list = list.filter((o) => o.status === q.status);
    if (q.q) {
      const needle = normalizeText(q.q);
      const digits = q.q.replace(/\D/g, "");
      list = list.filter((o) => {
        const haystack = normalizeText(
          [o.number, o.customer.name, o.customer.city, o.customer.email ?? ""].join(" ")
        );
        return haystack.includes(needle) || (digits.length > 3 && o.customer.phone.includes(digits));
      });
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    const total = list.length;
    return { items: list.slice((page - 1) * pageSize, page * pageSize), total };
  }

  async updateOrder(id: string, patch: { status?: Order["status"]; internalNotes?: string }): Promise<Order> {
    return withLock(async () => {
      const all = await readJson<Order[]>(FILES.orders, []);
      const idx = all.findIndex((o) => o.id === id);
      if (idx < 0) throw new PricingError("الطلب غير موجود", "not_found");
      const next: Order = { ...all[idx], updatedAt: Date.now() };
      if (patch.status && patch.status !== next.status) {
        next.status = patch.status;
        next.statusUpdatedAt = Date.now();
      }
      if (typeof patch.internalNotes === "string") next.internalNotes = patch.internalNotes.slice(0, 2000);
      all[idx] = next;
      await writeJson(FILES.orders, all);
      return next;
    });
  }

  async listCustomerOrders(uid: string): Promise<Order[]> {
    const all = await readJson<Order[]>(FILES.orders, []);
    return all.filter((o) => o.uid === uid).sort((a, b) => b.createdAt - a.createdAt);
  }

  async countCustomerOrders(uid: string): Promise<number> {
    const all = await readJson<Order[]>(FILES.orders, []);
    return all.filter((o) => o.uid === uid).length;
  }

  // ---------------- العملاء ----------------
  async getCustomer(uid: string): Promise<CustomerProfile | null> {
    const all = await readJson<CustomerProfile[]>(FILES.customers, []);
    return all.find((c) => c.uid === uid) ?? null;
  }

  async getCustomerByEmail(email: string): Promise<CustomerProfile | null> {
    const needle = (email || "").trim().toLowerCase();
    if (!needle) return null;
    const all = await readJson<CustomerProfile[]>(FILES.customers, []);
    return all.find((c) => c.email.toLowerCase() === needle) ?? null;
  }

  async saveAuthSecret(uid: string, secret: string): Promise<void> {
    await withLock(async () => {
      const data = await readJson<Record<string, string>>(FILES.auth, {});
      data[uid] = secret;
      await writeJson(FILES.auth, data);
    });
  }

  async getAuthSecret(uid: string): Promise<string | null> {
    const all = await readJson<Record<string, string>>(FILES.auth, {});
    return all[uid] ?? null;
  }

  async upsertCustomer(profile: CustomerProfile): Promise<CustomerProfile> {
    return withLock(async () => {
      const all = await readJson<CustomerProfile[]>(FILES.customers, []);
      const idx = all.findIndex((c) => c.uid === profile.uid);
      const record = { ...profile, updatedAt: Date.now() };
      if (idx >= 0) all[idx] = { ...all[idx], ...record };
      else all.push(record);
      await writeJson(FILES.customers, all);
      return idx >= 0 ? all[idx] : record;
    });
  }

  async listCustomers(q: CustomerQuery): Promise<{
    items: (CustomerProfile & { orderCount: number })[];
    total: number;
  }> {
    const all = await readJson<CustomerProfile[]>(FILES.customers, []);
    const orders = await readJson<Order[]>(FILES.orders, []);
    let list = [...all];
    if (q.q) {
      const needle = normalizeText(q.q);
      const digits = q.q.replace(/\D/g, "");
      list = list.filter((c) => {
        const haystack = normalizeText([c.name, c.email, c.city, c.phone].join(" "));
        return haystack.includes(needle) || (digits.length > 3 && c.phone.includes(digits));
      });
    }
    list.sort((a, b) => b.createdAt - a.createdAt);
    const pageSize = Math.min(Math.max(q.pageSize ?? 20, 1), 100);
    const page = Math.max(q.page ?? 1, 1);
    const total = list.length;
    const items = list.slice((page - 1) * pageSize, page * pageSize).map((c) => ({
      ...c,
      orderCount: orders.filter((o) => o.uid === c.uid).length,
    }));
    return { items, total };
  }

  async setCustomerDisabled(uid: string, disabled: boolean): Promise<CustomerProfile> {
    return withLock(async () => {
      const all = await readJson<CustomerProfile[]>(FILES.customers, []);
      const idx = all.findIndex((c) => c.uid === uid);
      if (idx < 0) throw new PricingError("العميل غير موجود", "not_found");
      all[idx] = { ...all[idx], disabled, updatedAt: Date.now() };
      await writeJson(FILES.customers, all);
      return all[idx];
    });
  }

  // ---------------- السلة ----------------
  async getCart(uid: string): Promise<CartLine[]> {
    const all = await readJson<Record<string, CartLine[]>>(FILES.carts, {});
    return all[uid] ?? [];
  }

  async setCart(uid: string, lines: CartLine[]): Promise<void> {
    await withLock(async () => {
      const all = await readJson<Record<string, CartLine[]>>(FILES.carts, {});
      all[uid] = (lines || []).slice(0, 60);
      await writeJson(FILES.carts, all);
    });
  }

  // ---------------- الإعدادات ----------------
  async getSettings(): Promise<StoreSettings> {
    return (await this.settings()).store;
  }

  async saveSettings(s: StoreSettings): Promise<void> {
    await withLock(async () => {
      const file = await this.settings();
      await writeJson(FILES.settings, { ...file, store: s } satisfies SettingsFile);
    });
  }

  async getPrivateSettings(): Promise<PrivateSettings> {
    return (await this.settings()).private;
  }

  async savePrivateSettings(p: PrivateSettings): Promise<void> {
    await withLock(async () => {
      const file = await this.settings();
      await writeJson(FILES.settings, { ...file, private: p } satisfies SettingsFile);
    });
  }

  async getHome(): Promise<HomeSettings> {
    return (await this.settings()).home;
  }

  async saveHome(h: HomeSettings): Promise<void> {
    await withLock(async () => {
      const file = await this.settings();
      await writeJson(FILES.settings, { ...file, home: h } satisfies SettingsFile);
    });
  }

  // ---------------- الصفحات ----------------
  async listPages(): Promise<PageDoc[]> {
    await this.ensureSeeded();
    return readJson<PageDoc[]>(FILES.pages, defaultPages());
  }

  async getPage(slug: string): Promise<PageDoc | null> {
    const all = await this.listPages();
    return all.find((p) => p.slug === slug) ?? null;
  }

  async savePage(p: PageDoc): Promise<PageDoc> {
    return withLock(async () => {
      const all = await readJson<PageDoc[]>(FILES.pages, []);
      const idx = all.findIndex((x) => x.slug === p.slug);
      const record = { ...p, updatedAt: Date.now() };
      if (idx >= 0) all[idx] = record;
      else all.push(record);
      await writeJson(FILES.pages, all);
      return record;
    });
  }

  // ---------------- التقييمات ----------------
  async listReviews(productId: string): Promise<Review[]> {
    const all = await readJson<Review[]>(FILES.reviews, []);
    return all.filter((r) => r.productId === productId).sort((a, b) => b.createdAt - a.createdAt);
  }

  async createReview(r: Review): Promise<Review> {
    return withLock(async () => {
      const all = await readJson<Review[]>(FILES.reviews, []);
      all.push(r);
      await writeJson(FILES.reviews, all);
      return r;
    });
  }

  // ---------------- المدراء ----------------
  async getAdminByUid(uid: string): Promise<AdminDoc | null> {
    const all = await readJson<AdminDoc[]>(FILES.admins, []);
    return all.find((a) => a.uid === uid) ?? null;
  }

  async getAdminByEmail(email: string): Promise<AdminDoc | null> {
    const all = await readJson<AdminDoc[]>(FILES.admins, []);
    const needle = email.trim().toLowerCase();
    return all.find((a) => a.email.toLowerCase() === needle) ?? null;
  }

  async listAdmins(): Promise<AdminDoc[]> {
    return readJson<AdminDoc[]>(FILES.admins, []);
  }

  async saveAdmin(a: AdminDoc): Promise<AdminDoc> {
    return withLock(async () => {
      const all = await readJson<AdminDoc[]>(FILES.admins, []);
      const idx = all.findIndex((x) => x.uid === a.uid);
      if (idx >= 0) all[idx] = { ...all[idx], ...a };
      else all.push(a);
      await writeJson(FILES.admins, all);
      return idx >= 0 ? all[idx] : a;
    });
  }

  async deleteAdmin(uid: string): Promise<void> {
    await withLock(async () => {
      const all = await readJson<AdminDoc[]>(FILES.admins, []);
      await writeJson(
        FILES.admins,
        all.filter((a) => a.uid !== uid)
      );
    });
  }

  // ---------------- سجل التدقيق ----------------
  async logAudit(entry: AuditEntry): Promise<void> {
    await withLock(async () => {
      const all = await readJson<AuditEntry[]>(FILES.audit, []);
      all.unshift(entry);
      await writeJson(FILES.audit, all.slice(0, 2000));
    });
  }

  async listAudit(limit = 200): Promise<AuditEntry[]> {
    const all = await readJson<AuditEntry[]>(FILES.audit, []);
    return all.slice(0, limit);
  }

  // ---------------- الرموز ----------------
  async saveToken(record: { key: string; uid: string; expiresAt: number }): Promise<void> {
    await withLock(async () => {
      const all = await readJson<Record<string, { uid: string; expiresAt: number }>>(FILES.tokens, {});
      const now = Date.now();
      for (const [key, value] of Object.entries(all)) if (value.expiresAt < now) delete all[key];
      all[record.key] = { uid: record.uid, expiresAt: record.expiresAt };
      await writeJson(FILES.tokens, all);
    });
  }

  async consumeToken(key: string): Promise<{ uid: string } | null> {
    return withLock(async () => {
      const all = await readJson<Record<string, { uid: string; expiresAt: number }>>(FILES.tokens, {});
      const hit = all[key];
      if (!hit) return null;
      delete all[key];
      await writeJson(FILES.tokens, all);
      if (hit.expiresAt < Date.now()) return null;
      return { uid: hit.uid };
    });
  }

  // ---------------- التخزين ----------------
  async saveUpload(bytes: Buffer, filename: string, kind: string): Promise<string> {
    const safeKind = kind.replace(/[^a-z0-9_-]/gi, "") || "misc";
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80);
    const dir = path.join(UPLOAD_DIR, safeKind);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, safeName), bytes);
    return `/api/files/${safeKind}/${safeName}`;
  }

  async deleteUpload(url: string): Promise<void> {
    if (!url.startsWith("/api/files/")) return;
    const relative = decodeURIComponent(url.replace("/api/files/", ""));
    const full = path.resolve(UPLOAD_DIR, relative);
    const root = path.resolve(UPLOAD_DIR);
    if (!full.startsWith(root)) return; // منع الخروج عن المجلد
    await fs.rm(full, { force: true });
  }
}

export const LOCAL_UPLOAD_ROOT = UPLOAD_DIR;
