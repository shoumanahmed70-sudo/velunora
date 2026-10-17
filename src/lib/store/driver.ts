import type {
  AuditEntry,
  Banner,
  CartLine,
  Category,
  CustomerProfile,
  HomeSettings,
  Order,
  OrderStatus,
  PageDoc,
  PrivateSettings,
  Product,
  Review,
  StoreSettings,
  AdminDoc,
} from "@/lib/types";

/** استعلام منتجات عام */
export interface ProductQuery {
  category?: string;
  tag?: "new" | "sale";
  featured?: boolean;
  q?: string;
  sort?: "newest" | "price_asc" | "price_desc" | "featured";
  limit?: number;
  cursor?: string;
  includeInactive?: boolean;
}

export interface OrderQuery {
  status?: OrderStatus | "all";
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CustomerQuery {
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateOrderInput {
  /** للحماية من الضغط المتكرر: مفتاح فريد يُنشئ خلال معاملة واحدة فقط */
  idempotencyKey: string;
  uid: string | null;
  customer: Order["customer"];
  /** العميل يرسل المعرّفات فقط — الأسعار تُقرأ من المنتجات داخل المعاملة */
  items: Array<{
    productId: string;
    variantId: string | null;
    options: Record<string, string>;
    qty: number;
  }>;
}

export interface CreateOrderResult {
  order: Order;
  /** true إذا كان المفتاح مسبقًا (طلب مكرر) */
  duplicate: boolean;
}

/**
 * العقد الذي يُنفّذه كل محرّك تخزين (محلي أو Firebase).
 * كل العمليات الحسّاسة (الطلبات/المخزون/الأرقام) تتم داخل معاملة على الخادم.
 */
export interface StoreDriver {
  // المنتجات
  listProducts(q: ProductQuery): Promise<{ items: Product[]; nextCursor: string | null }>;
  getProduct(id: string): Promise<Product | null>;
  getProductBySlug(slug: string): Promise<Product | null>;
  createProduct(data: Omit<Product, "id" | "createdAt" | "updatedAt">): Promise<Product>;
  updateProduct(id: string, patch: Partial<Omit<Product, "id">>): Promise<Product>;
  deleteProduct(id: string): Promise<void>;

  // التصنيفات
  listCategories(): Promise<Category[]>;
  saveCategory(c: Category): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  // الطلبات (معاملة ذرية: تحقق الأسعار + خصم المخزون + رقم فريد + منع التكرار)
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
  getOrder(id: string): Promise<Order | null>;
  getOrderByNumber(number: string): Promise<Order | null>;
  listOrders(q: OrderQuery): Promise<{ items: Order[]; total: number }>;
  updateOrder(id: string, patch: { status?: OrderStatus; internalNotes?: string }): Promise<Order>;
  listCustomerOrders(uid: string): Promise<Order[]>;
  countCustomerOrders(uid: string): Promise<number>;

  // العملاء
  getCustomer(uid: string): Promise<CustomerProfile | null>;
  getCustomerByEmail(email: string): Promise<CustomerProfile | null>;
  upsertCustomer(profile: CustomerProfile): Promise<CustomerProfile>;
  listCustomers(q: CustomerQuery): Promise<{ items: (CustomerProfile & { orderCount: number })[]; total: number }>;
  setCustomerDisabled(uid: string, disabled: boolean): Promise<CustomerProfile>;

  // أسرار المصادقة (كلمات المرور) — تُستخدم في المحرك المحلي فقط؛
  // Firebase يدير كلمات المرور عبر Firebase Authentication.
  saveAuthSecret(uid: string, secret: string): Promise<void>;
  getAuthSecret(uid: string): Promise<string | null>;

  // سلة العميل
  getCart(uid: string): Promise<CartLine[]>;
  setCart(uid: string, lines: CartLine[]): Promise<void>;

  // الإعدادات
  getSettings(): Promise<StoreSettings>;
  saveSettings(s: StoreSettings): Promise<void>;
  getPrivateSettings(): Promise<PrivateSettings>;
  savePrivateSettings(p: PrivateSettings): Promise<void>;
  getHome(): Promise<HomeSettings>;
  saveHome(h: HomeSettings): Promise<void>;

  // الصفحات (السياسات/من نحن)
  listPages(): Promise<PageDoc[]>;
  getPage(slug: string): Promise<PageDoc | null>;
  savePage(p: PageDoc): Promise<PageDoc>;

  // التقييمات
  listReviews(productId: string): Promise<Review[]>;
  createReview(r: Review): Promise<Review>;

  // المدراء
  getAdminByUid(uid: string): Promise<AdminDoc | null>;
  getAdminByEmail(email: string): Promise<AdminDoc | null>;
  listAdmins(): Promise<AdminDoc[]>;
  saveAdmin(a: AdminDoc): Promise<AdminDoc>;
  deleteAdmin(uid: string): Promise<void>;

  // سجل التدقيق
  logAudit(entry: AuditEntry): Promise<void>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  // رموز إعادة التعيين/التأكيد (مخزّنة مُجزّأة)
  saveToken(record: { key: string; uid: string; expiresAt: number }): Promise<void>;
  consumeToken(key: string): Promise<{ uid: string } | null>;

  // التخزين (صور)
  saveUpload(bytes: Buffer, filename: string, kind: string): Promise<string>;
  deleteUpload(url: string): Promise<void>;
}
