import "server-only";

import crypto from "node:crypto";
import { badRequest } from "@/lib/server/errors";
import type { Product, ProductOption, ProductVariant } from "@/lib/types";

/** التحقق من مدخلات المنتج وتنظيفها — لا يُقبل أي سعر أو مخزون خارج النطاق. */
export function parseProductInput(
  body: unknown
): Omit<Product, "id" | "createdAt" | "updatedAt"> {
  const b = (body || {}) as Record<string, unknown>;

  const name = String(b.name ?? "").trim().slice(0, 120);
  if (name.length < 2) throw badRequest("اسم المنتج مطلوب", "validation");

  const price = Number(b.price);
  if (!Number.isFinite(price) || price < 0) throw badRequest("السعر غير صحيح", "validation");

  const compareAtRaw = b.compareAtPrice;
  const compareAtPrice =
    compareAtRaw === null || compareAtRaw === undefined || compareAtRaw === "" ? null : Number(compareAtRaw);
  if (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
    throw badRequest("السعر قبل الخصم غير صحيح", "validation");
  }
  if (compareAtPrice !== null && compareAtPrice <= price) {
    throw badRequest("السعر قبل الخصم يجب أن يكون أعلى من السعر الحالي", "validation");
  }

  const rawVariants = Array.isArray(b.variants) ? b.variants.slice(0, 20) : [];
  const variants: ProductVariant[] = rawVariants.map((v) => {
    const item = (v || {}) as Record<string, unknown>;
    const label = String(item.label ?? "").trim().slice(0, 40);
    if (!label) throw badRequest("كل حجم يحتاج اسمًا (مثل: 50 مل)", "validation");
    const vPrice = Number(item.price);
    if (!Number.isFinite(vPrice) || vPrice < 0) throw badRequest("سعر الحجم غير صحيح", "validation");
    const vCompareRaw = item.compareAtPrice;
    const vCompare =
      vCompareRaw === null || vCompareRaw === undefined || vCompareRaw === "" ? null : Number(vCompareRaw);
    if (vCompare !== null && (!Number.isFinite(vCompare) || vCompare <= vPrice)) {
      throw badRequest("السعر قبل الخصم للحجم يجب أن يكون أعلى من سعره", "validation");
    }
    const stock = Math.max(0, Math.floor(Number(item.stock) || 0));
    return {
      id: String(item.id ?? "").trim() || crypto.randomUUID().slice(0, 8),
      label,
      labelEn: String(item.labelEn ?? "").trim().slice(0, 40),
      price: Math.round(vPrice * 100) / 100,
      compareAtPrice: vCompare === null ? null : Math.round(vCompare * 100) / 100,
      stock,
    };
  });

  const rawOptions = Array.isArray(b.options) ? b.options.slice(0, 8) : [];
  const options: ProductOption[] = rawOptions
    .map((o) => {
      const item = (o || {}) as Record<string, unknown>;
      return {
        label: String(item.label ?? "").trim().slice(0, 40),
        labelEn: String(item.labelEn ?? "").trim().slice(0, 40),
        values: Array.isArray(item.values)
          ? item.values.map((v) => String(v).trim().slice(0, 40)).filter(Boolean).slice(0, 10)
          : [],
      };
    })
    .filter((o) => o.label && o.values.length > 0);

  const variantsStock = variants.reduce((sum, v) => sum + v.stock, 0);
  const stock = variants.length ? variantsStock : Math.max(0, Math.floor(Number(b.stock) || 0));

  const images = Array.isArray(b.images)
    ? b.images
        .map((i) => String(i).trim())
        .filter((url) => url.startsWith("/api/files/") || url.startsWith("/brand/") || /^https:\/\//.test(url))
        .slice(0, 12)
    : [];

  return {
    slug: String(b.slug ?? "").trim().slice(0, 120),
    name,
    nameEn: String(b.nameEn ?? "").trim().slice(0, 120),
    description: String(b.description ?? "").trim().slice(0, 5000),
    descriptionEn: String(b.descriptionEn ?? "").trim().slice(0, 5000),
    category: String(b.category ?? "unisex").trim().slice(0, 60),
    images: images.length ? images : ["/brand/placeholder.svg"],
    price: Math.round(price * 100) / 100,
    compareAtPrice: compareAtPrice === null ? null : Math.round(compareAtPrice * 100) / 100,
    variants,
    options,
    stock,
    featured: b.featured === true,
    active: b.active !== false,
    order: Math.floor(Number(b.order) || 0),
    isNew: b.isNew === true,
    onSale: b.onSale === true || (compareAtPrice !== null && compareAtPrice > price),
  };
}
