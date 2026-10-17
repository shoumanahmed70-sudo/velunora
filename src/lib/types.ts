/**
 * VELUNORA — أنواع البيانات المشتركة بين الخادم والواجهة.
 * هذه الأمرات هي العقد الوحيد بين الطبقات، ولا يجوز تغييرها دون تحديث المساعدات.
 */

export type Lang = "ar" | "en";

export type CategorySlug = "men" | "women" | "unisex" | string;

export interface Category {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  order: number;
  active: boolean;
}

/** نسخة/حجم داخل المنتج (30 مل، 50 مل...) */
export interface ProductVariant {
  id: string;
  label: string;
  labelEn?: string;
  price: number;
  compareAtPrice?: number | null;
  stock: number;
}

/** خيار اختياري (مثال: التركيز Eau de Parfum / Eau de Toilette) */
export interface ProductOption {
  label: string;
  labelEn?: string;
  values: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  category: string;
  images: string[];
  price: number;
  compareAtPrice: number | null;
  variants: ProductVariant[];
  options: ProductOption[];
  stock: number;
  featured: boolean;
  active: boolean;
  order: number;
  isNew: boolean;
  onSale: boolean;
  createdAt: number;
  updatedAt: number;
}

export type OrderStatus =
  | "new"
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "completed"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "new",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];

export interface OrderItem {
  productId: string;
  variantId: string | null;
  name: string;
  nameEn: string;
  image: string | null;
  variantLabel: string | null;
  options: Record<string, string>;
  unitPrice: number;
  compareAtPrice: number | null;
  qty: number;
  total: number;
}

export interface OrderCustomer {
  name: string;
  phone: string;
  city: string;
  address: string;
  notes: string;
  email: string | null;
}

export interface Order {
  id: string;
  number: string;
  uid: string | null;
  customer: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
  currency: string;
  status: OrderStatus;
  internalNotes: string;
  idempotencyKey: string | null;
  createdAt: number;
  updatedAt: number;
  statusUpdatedAt: number | null;
}

export interface CustomerProfile {
  uid: string;
  email: string;
  name: string;
  phone: string;
  city: string;
  address: string;
  emailVerified: boolean;
  disabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface StoreContact {
  phone: string;
  email: string;
  address: string;
  addressEn: string;
  workingHours: string;
}

export interface StoreSocial {
  instagram: string;
  tiktok: string;
  snapchat: string;
  facebook: string;
  x: string;
}

export interface StoreColors {
  primary: string;
  primarySoft: string;
  gold: string;
  cream: string;
  background: string;
  text: string;
}

/** الإعدادات العامة (يمكن قراءتها من الواجهة) */
export interface StoreSettings {
  storeName: string;
  storeNameEn: string;
  tagline: string;
  taglineEn: string;
  logoUrl: string;
  faviconUrl: string;
  colors: StoreColors;
  headingFont: string;
  bodyFont: string;
  currency: string;
  currencySymbol: string;
  taxEnabled: boolean;
  taxRate: number;
  shippingFee: number;
  freeShippingOver: number | null;
  minOrder: number;
  ordersEnabled: boolean;
  reviewsEnabled: boolean;
  contact: StoreContact;
  social: StoreSocial;
  announcement: string;
  announcementEn: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
}

/** إعدادات خاصة بالخادم فقط — لا تُقرأ من الواجهة العامة أبدًا */
export interface PrivateSettings {
  /** رقم واتساب المدير مع رمز الدولة بدون + (مثال: 966555555555) */
  whatsappNumber: string;
  smtp: {
    enabled: boolean;
    host: string;
    port: number;
    secure: boolean;
    user: string;
    pass: string;
    from: string;
  };
}

export interface Banner {
  id: string;
  image: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  buttonText: string;
  buttonTextEn: string;
  buttonHref: string;
  active: boolean;
}

export type HomeSectionType =
  | "categories"
  | "featured"
  | "new"
  | "sale"
  | "bestsellers"
  | "banner";

export interface HomeSection {
  id: string;
  type: HomeSectionType;
  title: string;
  titleEn: string;
  limit: number;
  /** للقسم المخصص: معرّفات منتجات مختارة (اختياري) */
  productIds: string[];
  image: string;
  active: boolean;
  order: number;
}

export interface HomeSettings {
  heroTitle: string;
  heroTitleEn: string;
  heroSubtitle: string;
  heroSubtitleEn: string;
  heroButtonText: string;
  heroButtonTextEn: string;
  heroButtonHref: string;
  heroImage: string;
  banners: Banner[];
  sections: HomeSection[];
}

export interface PageDoc {
  slug: string;
  title: string;
  titleEn: string;
  content: string;
  contentEn: string;
  updatedAt: number;
}

export interface Review {
  id: string;
  productId: string;
  uid: string;
  authorName: string;
  orderNumber: string;
  rating: number;
  comment: string;
  createdAt: number;
}

export type AdminRole = "owner" | "staff";

export type AdminPermission =
  | "products"
  | "orders"
  | "customers"
  | "settings"
  | "home"
  | "pages"
  | "audit";

export interface AdminDoc {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
  createdAt: number;
  lastLoginAt: number | null;
}

export interface AuditEntry {
  id: string;
  actorUid: string;
  actorEmail: string;
  action: string;
  target: string;
  meta: string;
  createdAt: number;
}

/** عنصر سلة العميل */
export interface CartLine {
  productId: string;
  variantId: string | null;
  options: Record<string, string>;
  qty: number;
}

/** المستخدم الحالي كما يعيده /api/auth/me */
export interface MeResponse {
  user: {
    uid: string;
    email: string;
    name: string;
    emailVerified: boolean;
    disabled: boolean;
    phone?: string;
    city?: string;
    address?: string;
  } | null;
  admin: {
    uid?: string;
    email?: string;
    name?: string;
    role: AdminRole;
    permissions: AdminPermission[];
  } | null;
}
