import type { Order, OrderItem, Product, StoreSettings } from "@/lib/types";

export function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export class PricingError extends Error {
  code: string;
  constructor(message: string, code = "validation") {
    super(message);
    this.code = code;
  }
}

/** سعر النسخة (الحجم) أو سعر المنتج الأساسي. */
export function resolvePrice(product: Product, variantId: string | null) {
  if (variantId) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (!variant) throw new PricingError("الحجم المطلوب غير متوفر لهذا المنتج", "validation");
    return {
      price: round2(variant.price),
      compareAtPrice: variant.compareAtPrice ? round2(variant.compareAtPrice) : null,
      label: variant.label,
      stock: variant.stock,
    };
  }
  return {
    price: round2(product.price),
    compareAtPrice: product.compareAtPrice ? round2(product.compareAtPrice) : null,
    label: null,
    stock: product.stock,
  };
}

/** بناء بند طلب من بيانات الخادم فقط (لا يُعتمد أي سعر قادم من المتصفح). */
export function buildOrderItem(
  product: Product,
  variantId: string | null,
  options: Record<string, string>,
  qty: number
): OrderItem {
  const q = Math.floor(Number(qty));
  if (!Number.isInteger(q) || q < 1 || q > 99) {
    throw new PricingError("كمية غير صحيحة", "validation");
  }
  const { price, compareAtPrice, label, stock } = resolvePrice(product, variantId);

  // منع قيم خيارات غير معرّفة
  const safeOptions: Record<string, string> = {};
  for (const [key, value] of Object.entries(options || {})) {
    const option = product.options.find((o) => o.label === key);
    if (!option) throw new PricingError("خيار غير معرّف في المنتج", "validation");
    if (!option.values.includes(value)) throw new PricingError("قيمة خيار غير صحيحة", "validation");
    safeOptions[key] = value;
  }

  if (stock < q) {
    throw new PricingError(`الكمية المتوفرة من «${product.name}» هي ${stock}`, "stock");
  }

  return {
    productId: product.id,
    variantId,
    name: product.name,
    nameEn: product.nameEn,
    image: product.images[0] ?? null,
    variantLabel: label,
    options: safeOptions,
    unitPrice: price,
    compareAtPrice,
    qty: q,
    total: round2(price * q),
  };
}

export interface Totals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

/**
 * حساب المجاميع: المجموع الفرعي، الخصم، الشحن، الضريبة، الإجمالي.
 *
 * ملاحظة مهمة: `compareAtPrice` هو سعر «قبل الخصم» للعرض فقط (يُشطب في الواجهة)،
 * وليس خصمًا إضافيًا. لذلك المجموع الفرعي = مجموع (سعر البيع × الكمية)، والخصم = 0
 * (محجوز لنظام كوبونات مستقبلي). بهذا يتحقق دائمًا: subtotal = Σ(item.total)
 * و total = subtotal + shipping + tax.
 */
export function computeTotals(items: OrderItem[], settings: StoreSettings): Totals {
  const subtotal = round2(items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0));
  const discount = 0;

  const net = round2(subtotal - discount);

  let shipping = round2(settings.shippingFee || 0);
  if (net <= 0) shipping = 0;
  else if (settings.freeShippingOver != null && net >= settings.freeShippingOver) shipping = 0;

  const taxableBase = round2(net + shipping);
  const tax = settings.taxEnabled ? round2((taxableBase * (settings.taxRate || 0)) / 100) : 0;

  const total = round2(net + shipping + tax);

  return { subtotal, discount, shipping, tax, total };
}

/** التحقق من الحد الأدنى للطلب. */
export function assertMinOrder(items: OrderItem[], settings: StoreSettings) {
  const subtotal = round2(items.reduce((s, i) => s + i.unitPrice * i.qty, 0));
  const net = subtotal;
  if (settings.minOrder > 0 && net < settings.minOrder) {
    throw new PricingError(
      `الحد الأدنى للطلب هو ${settings.minOrder} ${settings.currencySymbol}`,
      "validation"
    );
  }
}

/** سطر سلة خام كما يصل من العميل (قبل قراءة الأسعار من قاعدة البيانات). */
export interface RawOrderLine {
  productId: string;
  variantId?: string | null;
  options?: Record<string, string>;
  qty: number;
}

/**
 * مفتاح توحيد البنود: نفس المنتج + نفس الحجم + نفس الخيارات = بند واحد.
 * تُرتَّب مفاتيح الخيارات ليكون الترتيب غير مؤثّر.
 */
export function lineMergeKey(line: RawOrderLine): string {
  const opts = Object.entries(line.options || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  return `${line.productId}|${line.variantId || ""}|${opts}`;
}

/**
 * دمج البنود المتطابقة بجمع كمياتها (بحد أقصى 99 لكل بند).
 *
 * السبب: بند واحد بمخزون كافٍ قد يُقسَّم إلى بنود مكرّرة لتجاوز فحص المخزون
 * (بيع أكثر من المتوفر)، أو لكتابة أكثر من `tx.update` على نفس المنتج فيضيع
 * آخر خصم. الدمج قبل أي فحص أو خصم يمنع ذلك.
 */
export function mergeOrderLines(lines: RawOrderLine[]): RawOrderLine[] {
  const map = new Map<string, RawOrderLine>();
  for (const line of lines || []) {
    const qty = Math.floor(Number(line?.qty));
    if (!line?.productId || !Number.isInteger(qty) || qty < 1) continue;
    const key = lineMergeKey(line);
    const existing = map.get(key);
    if (existing) existing.qty = Math.min(99, existing.qty + qty);
    else map.set(key, { ...line, qty: Math.min(99, qty) });
  }
  return [...map.values()];
}

export function emptyOrder(): Order {
  const now = Date.now();
  return {
    id: "",
    number: "",
    uid: null,
    customer: { name: "", phone: "", city: "", address: "", notes: "", email: null },
    items: [],
    subtotal: 0,
    discount: 0,
    shipping: 0,
    tax: 0,
    total: 0,
    currency: "SAR",
    status: "new",
    internalNotes: "",
    idempotencyKey: null,
    createdAt: now,
    updatedAt: now,
    statusUpdatedAt: null,
  };
}
