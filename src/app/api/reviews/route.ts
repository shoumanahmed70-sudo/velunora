import { getDriver } from "@/lib/store";
import { requireUserApi } from "@/lib/server/guard";
import { asNumber, asString, json, readJson, route } from "@/lib/server/http";
import { badRequest, forbidden } from "@/lib/server/errors";
import { REVIEWABLE_STATUSES } from "@/lib/order-status";
import type { Review } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** تقييمات منتج (عامة) */
export const GET = route(async (request: Request) => {
  const productId = asString(new URL(request.url).searchParams.get("productId"), 80);
  if (!productId) return json({ items: [] });
  const db = await getDriver();
  return json({ items: await db.listReviews(productId) });
});

interface Body {
  productId?: string;
  rating?: number;
  comment?: string;
}

/**
 * نشر تقييم: يتطلب تسجيل الدخول + شراء موثّق (طلب يحتوي المنتج بحالة مؤكدة أو لاحقة)
 * + أن تكون ميزة التقييمات مفعّلة من لوحة الإدارة. لا يُقبل أي تقييم من زائر.
 */
export const POST = route(async (request: Request) => {
  const { uid } = await requireUserApi();
  const body = await readJson<Body>(request);
  const productId = (body.productId || "").trim();
  const rating = Math.floor(asNumber(body.rating, 0));
  const comment = (body.comment || "").trim().slice(0, 600);

  if (!productId) throw badRequest("المنتج غير محدد", "validation");
  if (rating < 1 || rating > 5) throw badRequest("التقييم يجب أن يكون من 1 إلى 5", "validation");

  const db = await getDriver();
  const settings = await db.getSettings();
  if (!settings.reviewsEnabled) throw forbidden("ميزة التقييمات غير مفعّلة حاليًا", "reviews_disabled");

  const product = await db.getProduct(productId);
  if (!product) throw badRequest("المنتج غير موجود", "validation");

  const orders = await db.listCustomerOrders(uid);
  const purchased = orders.find(
    (order) => REVIEWABLE_STATUSES.includes(order.status) && order.items.some((i) => i.productId === productId)
  );
  if (!purchased) throw forbidden("التقييم متاح لمن اشترى هذا العطر فقط", "purchase_required");

  const existing = await db.listReviews(productId);
  if (existing.some((r) => r.uid === uid)) throw badRequest("لديك تقييم سابق لهذا المنتج", "already_reviewed");

  const profile = await db.getCustomer(uid);
  const review: Review = {
    id: `rev_${crypto.randomUUID()}`,
    productId,
    uid,
    authorName: profile?.name?.trim() || "عميل",
    orderNumber: purchased.number,
    rating,
    comment,
    createdAt: Date.now(),
  };

  await db.createReview(review);
  return json({ review }, 201);
});
