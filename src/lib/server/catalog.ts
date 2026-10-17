import "server-only";

import { getDriver } from "@/lib/store";
import { buildContactMessage, buildWaUrl } from "@/lib/server/whatsapp";
import { FIREBASE_ENABLED, FIREBASE_WEB_CONFIG, GOOGLE_AUTH_ENABLED } from "@/lib/server/env";
import type {
  Category,
  HomeSettings,
  Order,
  PageDoc,
  Product,
  Review,
  StoreSettings,
} from "@/lib/types";
import type { ProductQuery } from "@/lib/store/driver";

/**
 * قراءات الخادم (SSR) — تُستخدم في مكوّنات الخادم وفي مسارات الـ API.
 * لا تُصدّر أي بيانات خاصة (رقم واتساب/إعدادات SMTP) من هنا.
 */

export async function getSettings(): Promise<StoreSettings> {
  return (await getDriver()).getSettings();
}

export async function getHome(): Promise<HomeSettings> {
  return (await getDriver()).getHome();
}

export async function getCategories(): Promise<Category[]> {
  return (await getDriver()).listCategories();
}

export interface PublicStore {
  settings: StoreSettings;
  home: HomeSettings;
  categories: Category[];
  contactWaUrl: string;
  /** تفعيل تسجيل Google (يُخفى الزر إن لم يكن مُعدًّا) */
  googleAuthEnabled: boolean;
  /** إعدادات Firebase العامة (مفاتيح الويب عامة بطبيعتها) أو null في الوضع المحلي */
  firebaseConfig: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  } | null;
}

export async function getPublicStore(): Promise<PublicStore> {
  const db = await getDriver();
  const [settings, home, categories, priv] = await Promise.all([
    db.getSettings(),
    db.getHome(),
    db.listCategories(),
    db.getPrivateSettings(),
  ]);
  return {
    settings,
    home,
    categories: categories.filter((c) => c.active),
    // الرابط يُبنى على الخادم؛ الرقم نفسه لا يُرسل للواجهة
    contactWaUrl: buildWaUrl(priv.whatsappNumber, buildContactMessage(settings)),
    googleAuthEnabled: GOOGLE_AUTH_ENABLED,
    firebaseConfig: FIREBASE_ENABLED ? FIREBASE_WEB_CONFIG : null,
  };
}

export async function listProducts(q: ProductQuery): Promise<{ items: Product[]; nextCursor: string | null }> {
  return (await getDriver()).listProducts({ ...q, includeInactive: false });
}

export async function getProduct(idOrSlug: string): Promise<Product | null> {
  const db = await getDriver();
  const byId = await db.getProduct(idOrSlug);
  if (byId && byId.active) return byId;
  const bySlug = await db.getProductBySlug(idOrSlug);
  if (bySlug && bySlug.active) return bySlug;
  return null;
}

export async function listReviews(productId: string): Promise<Review[]> {
  return (await getDriver()).listReviews(productId);
}

export async function getPage(slug: string): Promise<PageDoc | null> {
  return (await getDriver()).getPage(slug);
}

export async function listPages(): Promise<PageDoc[]> {
  return (await getDriver()).listPages();
}

export async function getCustomerOrders(uid: string): Promise<Order[]> {
  return (await getDriver()).listCustomerOrders(uid);
}
