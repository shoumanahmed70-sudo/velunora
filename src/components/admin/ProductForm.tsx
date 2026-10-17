"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { ApiError, errorMessage, useApi } from "@/lib/api-client";
import { useStore } from "@/lib/store-provider";
import { useToast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import {
  ConfirmDialog,
  ErrorBlock,
  Field,
  ImageUploader,
  LoadingBlock,
  Panel,
  Toggle,
  inputCls,
} from "@/components/admin/ui";
import type { Category, Product, ProductOption, ProductVariant } from "@/lib/types";

interface VariantRow {
  id: string;
  label: string;
  labelEn: string;
  price: string;
  compareAtPrice: string;
  stock: string;
}

interface OptionRow {
  label: string;
  labelEn: string;
  values: string;
}

interface FormState {
  name: string;
  nameEn: string;
  slug: string;
  description: string;
  descriptionEn: string;
  category: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  featured: boolean;
  active: boolean;
  isNew: boolean;
  onSale: boolean;
  order: string;
  variants: VariantRow[];
  options: OptionRow[];
  images: string[];
}

const EMPTY: FormState = {
  name: "",
  nameEn: "",
  slug: "",
  description: "",
  descriptionEn: "",
  category: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  featured: false,
  active: true,
  isNew: false,
  onSale: false,
  order: "0",
  variants: [],
  options: [],
  images: [],
};

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06FF-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function newVariantId(label: string, index: number): string {
  const base = slugify(label) || `variant-${index + 1}`;
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${base}-${crypto.randomUUID().slice(0, 8)}`;
    }
  } catch {
    /* fallthrough */
  }
  return `${base}-${Date.now().toString(36)}-${index}`;
}

function viteToRow(v: ProductVariant): VariantRow {
  return {
    id: v.id,
    label: v.label,
    labelEn: v.labelEn ?? "",
    price: String(v.price ?? ""),
    compareAtPrice: v.compareAtPrice == null ? "" : String(v.compareAtPrice),
    stock: String(v.stock ?? 0),
  };
}

export default function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const apiClient = useApi();
  const toast = useToast();
  const { settings } = useStore();

  const isEdit = Boolean(productId);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const authRedirect = useCallback(
    (err: unknown): boolean => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return true;
      }
      return false;
    },
    [router, toast]
  );

  const loadCategories = useCallback(async () => {
    try {
      const data = await apiClient.get<{ items?: Category[]; categories?: Category[] }>(
        "/api/admin/categories"
      );
      setCategories(data.items ?? data.categories ?? []);
    } catch {
      setCategories([]);
    }
  }, [apiClient]);

  const loadProduct = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<{ product: Product }>(`/api/admin/products/${productId}`);
      const p = data.product;
      setForm({
        name: p.name ?? "",
        nameEn: p.nameEn ?? "",
        slug: p.slug ?? "",
        description: p.description ?? "",
        descriptionEn: p.descriptionEn ?? "",
        category: p.category ?? "",
        price: String(p.price ?? ""),
        compareAtPrice: p.compareAtPrice == null ? "" : String(p.compareAtPrice),
        stock: String(p.stock ?? 0),
        featured: Boolean(p.featured),
        active: Boolean(p.active),
        isNew: Boolean(p.isNew),
        onSale: Boolean(p.onSale),
        order: String(p.order ?? 0),
        variants: (p.variants ?? []).map(viteToRow),
        options: (p.options ?? []).map((o) => ({
          label: o.label,
          labelEn: o.labelEn ?? "",
          values: (o.values ?? []).join(", "),
        })),
        images: p.images ?? [],
      });
    } catch (err) {
      if (!authRedirect(err)) setLoadError(errorMessage(err, "تعذّر تحميل بيانات المنتج"));
    } finally {
      setLoading(false);
    }
  }, [apiClient, authRedirect, productId]);

  useEffect(() => {
    void loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const variantsTotal = useMemo(
    () => form.variants.reduce((sum, v) => sum + toNumber(v.stock), 0),
    [form.variants]
  );

  const discountPercent = useMemo(() => {
    const price = toNumber(form.price);
    const compareAt = toNumber(form.compareAtPrice);
    if (compareAt > 0 && price > 0 && compareAt > price) {
      return Math.round((1 - price / compareAt) * 100);
    }
    return 0;
  }, [form.price, form.compareAtPrice]);

  function patch(update: Partial<FormState>) {
    setForm((prev) => ({ ...prev, ...update }));
  }

  function addVariant() {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...prev.variants,
        {
          id: newVariantId("", prev.variants.length),
          label: "",
          labelEn: "",
          price: prev.price || "",
          compareAtPrice: prev.compareAtPrice || "",
          stock: "0",
        },
      ],
    }));
  }

  function updateVariant(index: number, update: Partial<VariantRow>) {
    setForm((prev) => ({
      ...prev,
      variants: prev.variants.map((v, i) => (i === index ? { ...v, ...update } : v)),
    }));
  }

  function removeVariant(index: number) {
    setForm((prev) => ({ ...prev, variants: prev.variants.filter((_, i) => i !== index) }));
  }

  function addOption() {
    setForm((prev) => ({ ...prev, options: [...prev.options, { label: "", labelEn: "", values: "" }] }));
  }

  function updateOption(index: number, update: Partial<OptionRow>) {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === index ? { ...o, ...update } : o)),
    }));
  }

  function removeOption(index: number) {
    setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    const name = form.name.trim();
    if (!name) next.name = "اسم المنتج مطلوب";

    const price = toNumber(form.price);
    if (form.price.trim() === "") next.price = "السعر مطلوب";
    else if (price <= 0) next.price = "يجب أن يكون السعر أكبر من صفر";

    if (form.compareAtPrice.trim() !== "") {
      const compareAt = toNumber(form.compareAtPrice);
      if (compareAt <= price) next.compareAtPrice = "يجب أن يكون السعر قبل الخصم أكبر من السعر";
    }

    if (form.stock.trim() === "" || toNumber(form.stock) < 0) {
      next.stock = "المخزون لا يمكن أن يكون سالبًا";
    }

    form.variants.forEach((v, index) => {
      if (!v.label.trim()) next[`variant-${index}-label`] = "اسم الحجم مطلوب";
      if (v.price.trim() === "" || toNumber(v.price) <= 0) {
        next[`variant-${index}-price`] = "السعر مطلوب وأكبر من صفر";
      }
      if (v.compareAtPrice.trim() !== "" && toNumber(v.compareAtPrice) <= toNumber(v.price)) {
        next[`variant-${index}-compareAtPrice`] = "يجب أن يكون أكبر من السعر";
      }
      if (v.stock.trim() === "" || toNumber(v.stock) < 0) {
        next[`variant-${index}-stock`] = "لا يمكن أن يكون سالبًا";
      }
    });

    form.options.forEach((o, index) => {
      if (!o.label.trim()) next[`option-${index}-label`] = "اسم الخيار مطلوب";
      const values = o.values.split(",").map((v) => v.trim()).filter(Boolean);
      if (values.length === 0) next[`option-${index}-values`] = "أدخل قيمة واحدة على الأقل";
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload() {
    const variants: ProductVariant[] = form.variants.map((v, index) => ({
      id: v.id || newVariantId(v.label, index),
      label: v.label.trim(),
      labelEn: v.labelEn.trim() || undefined,
      price: toNumber(v.price),
      compareAtPrice: v.compareAtPrice.trim() === "" ? null : toNumber(v.compareAtPrice),
      stock: Math.max(0, Math.floor(toNumber(v.stock))),
    }));

    const options: ProductOption[] = form.options.map((o) => ({
      label: o.label.trim(),
      labelEn: o.labelEn.trim() || undefined,
      values: o.values.split(",").map((v) => v.trim()).filter(Boolean),
    }));

    const stock = variants.length > 0
      ? variants.reduce((sum, v) => sum + v.stock, 0)
      : Math.max(0, Math.floor(toNumber(form.stock)));

    const slug = form.slug.trim() || slugify(form.nameEn || form.name);

    return {
      name: form.name.trim(),
      nameEn: form.nameEn.trim(),
      slug,
      description: form.description,
      descriptionEn: form.descriptionEn,
      category: form.category,
      images: form.images,
      price: toNumber(form.price),
      compareAtPrice: form.compareAtPrice.trim() === "" ? null : toNumber(form.compareAtPrice),
      variants,
      options,
      stock,
      featured: form.featured,
      active: form.active,
      isNew: form.isNew,
      onSale: form.onSale,
      order: toNumber(form.order),
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!validate()) {
      toast("تحقق من الحقول المطلوبة", "error");
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();
      if (isEdit && productId) {
        await apiClient.put(`/api/admin/products/${productId}`, payload);
        toast("تم حفظ التعديلات", "success");
      } else {
        await apiClient.post("/api/admin/products", payload);
        toast("تم إنشاء المنتج", "success");
      }
      router.push("/admin/products");
    } catch (err) {
      if (!authRedirect(err)) toast(errorMessage(err, "تعذّر حفظ المنتج"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!productId || deleting) return;
    setDeleting(true);
    try {
      await apiClient.del(`/api/admin/products/${productId}`);
      toast("تم حذف المنتج", "success");
      setConfirmDelete(false);
      router.push("/admin/products");
    } catch (err) {
      if (!authRedirect(err)) toast(errorMessage(err, "تعذّر حذف المنتج"), "error");
    } finally {
      setDeleting(false);
    }
  }

  if (isEdit && loading) return <LoadingBlock label="جارٍ تحميل المنتج…" />;
  if (loadError) return <ErrorBlock message={loadError} onRetry={() => void loadProduct()} />;

  const previewImage = form.images[0];
  const previewPrice = toNumber(form.price);

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <Panel title="البيانات الأساسية">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم المنتج" required>
                <input
                  className={inputCls}
                  value={form.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="مثال: عطر مسك الليل"
                />
                {errors.name ? <span className="mt-1 block text-xs font-semibold text-red-700">{errors.name}</span> : null}
              </Field>

              <Field label="الاسم بالإنجليزية">
                <input
                  dir="ltr"
                  className={`${inputCls} text-start`}
                  value={form.nameEn}
                  onChange={(e) => patch({ nameEn: e.target.value })}
                  placeholder="Midnight Musk"
                />
              </Field>

              <Field label="الرابط (Slug)" hint="يُولَّد تلقائيًا من الاسم إن تُرك فارغًا">
                <input
                  dir="ltr"
                  className={`${inputCls} text-start`}
                  value={form.slug}
                  onChange={(e) => patch({ slug: e.target.value })}
                  placeholder="midnight-musk"
                />
              </Field>

              <Field label="القسم">
                <select
                  className={inputCls}
                  value={form.category}
                  onChange={(e) => patch({ category: e.target.value })}
                >
                  <option value="">— بدون قسم —</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid gap-4">
              <Field label="الوصف">
                <textarea
                  className={`${inputCls} min-h-28`}
                  value={form.description}
                  onChange={(e) => patch({ description: e.target.value })}
                  placeholder="وصف تفصيلي للمنتج…"
                />
              </Field>
              <Field label="الوصف بالإنجليزية">
                <textarea
                  dir="ltr"
                  className={`${inputCls} min-h-24 text-start`}
                  value={form.descriptionEn}
                  onChange={(e) => patch({ descriptionEn: e.target.value })}
                  placeholder="Product description…"
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title="الأحجام (المتغيّرات)"
            description="عند إضافة أحجام يصبح مخزون المنتج مجموع مخزون الأحجام."
            actions={
              <button type="button" className="btn btn-outline px-4 py-1.5 text-xs" onClick={addVariant}>
                <Plus className="h-4 w-4" /> إضافة حجم
              </button>
            }
          >
            {form.variants.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-xs text-muted">
                لا توجد أحجام — سيُستخدم حقل «المخزون» الأساسي.
              </p>
            ) : (
              <div className="space-y-4">
                {form.variants.map((v, index) => (
                  <div key={index} className="rounded-xl border border-line bg-cream/30 p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="اسم الحجم" required>
                        <input
                          className={inputCls}
                          value={v.label}
                          onChange={(e) => updateVariant(index, { label: e.target.value })}
                          placeholder="50 مل"
                        />
                        {errors[`variant-${index}-label`] ? (
                          <span className="mt-1 block text-xs font-semibold text-red-700">
                            {errors[`variant-${index}-label`]}
                          </span>
                        ) : null}
                      </Field>
                      <Field label="الحجم بالإنجليزية">
                        <input
                          dir="ltr"
                          className={`${inputCls} text-start`}
                          value={v.labelEn}
                          onChange={(e) => updateVariant(index, { labelEn: e.target.value })}
                          placeholder="50 ml"
                        />
                      </Field>
                      <Field label="المخزون" required>
                        <input
                          type="number"
                          min={0}
                          className={inputCls}
                          value={v.stock}
                          onChange={(e) => updateVariant(index, { stock: e.target.value })}
                        />
                        {errors[`variant-${index}-stock`] ? (
                          <span className="mt-1 block text-xs font-semibold text-red-700">
                            {errors[`variant-${index}-stock`]}
                          </span>
                        ) : null}
                      </Field>
                      <Field label="السعر" required>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          dir="ltr"
                          className={`${inputCls} text-start`}
                          value={v.price}
                          onChange={(e) => updateVariant(index, { price: e.target.value })}
                        />
                        {errors[`variant-${index}-price`] ? (
                          <span className="mt-1 block text-xs font-semibold text-red-700">
                            {errors[`variant-${index}-price`]}
                          </span>
                        ) : null}
                      </Field>
                      <Field label="السعر قبل الخصم">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          dir="ltr"
                          className={`${inputCls} text-start`}
                          value={v.compareAtPrice}
                          onChange={(e) => updateVariant(index, { compareAtPrice: e.target.value })}
                        />
                        {errors[`variant-${index}-compareAtPrice`] ? (
                          <span className="mt-1 block text-xs font-semibold text-red-700">
                            {errors[`variant-${index}-compareAtPrice`]}
                          </span>
                        ) : null}
                      </Field>
                    </div>
                    <div className="mt-3 text-end">
                      <button
                        type="button"
                        onClick={() => removeVariant(index)}
                        className="btn btn-ghost px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> حذف الحجم
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-sm font-semibold text-ink">
                  إجمالي مخزون الأحجام:{" "}
                  <span className="rounded-full bg-cream px-3 py-1 text-gold">{variantsTotal}</span>
                </p>
              </div>
            )}
          </Panel>

          <Panel
            title="الخيارات"
            description="مثال: التركيز — القيم مفصولة بفواصل."
            actions={
              <button type="button" className="btn btn-outline px-4 py-1.5 text-xs" onClick={addOption}>
                <Plus className="h-4 w-4" /> إضافة خيار
              </button>
            }
          >
            {form.options.length === 0 ? (
              <p className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-6 text-center text-xs text-muted">
                لا توجد خيارات.
              </p>
            ) : (
              <div className="space-y-4">
                {form.options.map((o, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-line bg-cream/30 p-3 sm:grid-cols-3">
                    <Field label="اسم الخيار" required>
                      <input
                        className={inputCls}
                        value={o.label}
                        onChange={(e) => updateOption(index, { label: e.target.value })}
                        placeholder="التركيز"
                      />
                      {errors[`option-${index}-label`] ? (
                        <span className="mt-1 block text-xs font-semibold text-red-700">
                          {errors[`option-${index}-label`]}
                        </span>
                      ) : null}
                    </Field>
                    <Field label="الخيار بالإنجليزية">
                      <input
                        dir="ltr"
                        className={`${inputCls} text-start`}
                        value={o.labelEn}
                        onChange={(e) => updateOption(index, { labelEn: e.target.value })}
                        placeholder="Concentration"
                      />
                    </Field>
                    <Field label="القيم (مفصولة بفواصل)" required>
                      <input
                        className={inputCls}
                        value={o.values}
                        onChange={(e) => updateOption(index, { values: e.target.value })}
                        placeholder="Eau de Parfum, Eau de Toilette"
                      />
                      {errors[`option-${index}-values`] ? (
                        <span className="mt-1 block text-xs font-semibold text-red-700">
                          {errors[`option-${index}-values`]}
                        </span>
                      ) : null}
                    </Field>
                    <div className="sm:col-span-3 text-end">
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        className="btn btn-ghost px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> حذف الخيار
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="الأسعار والمخزون والترتيب">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="السعر" required>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className={`${inputCls} text-start`}
                  value={form.price}
                  onChange={(e) => patch({ price: e.target.value })}
                />
                {errors.price ? <span className="mt-1 block text-xs font-semibold text-red-700">{errors.price}</span> : null}
              </Field>

              <Field label="السعر قبل الخصم (اختياري)">
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  dir="ltr"
                  className={`${inputCls} text-start`}
                  value={form.compareAtPrice}
                  onChange={(e) => patch({ compareAtPrice: e.target.value })}
                />
                {errors.compareAtPrice ? (
                  <span className="mt-1 block text-xs font-semibold text-red-700">{errors.compareAtPrice}</span>
                ) : null}
              </Field>

              <Field
                label="المخزون"
                hint={form.variants.length > 0 ? "يُحسب تلقائيًا من مجموع الأحجام" : undefined}
              >
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={form.variants.length > 0 ? String(variantsTotal) : form.stock}
                  onChange={(e) => patch({ stock: e.target.value })}
                  disabled={form.variants.length > 0}
                />
                {errors.stock ? <span className="mt-1 block text-xs font-semibold text-red-700">{errors.stock}</span> : null}
              </Field>

              <Field label="ترتيب العرض" hint="الأصغر يظهر أولًا">
                <input
                  type="number"
                  dir="ltr"
                  className={`${inputCls} text-start`}
                  value={form.order}
                  onChange={(e) => patch({ order: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-6">
              <Toggle checked={form.active} onChange={(v) => patch({ active: v })} label="مفعّل" />
              <Toggle checked={form.featured} onChange={(v) => patch({ featured: v })} label="مميز" />
              <Toggle checked={form.isNew} onChange={(v) => patch({ isNew: v })} label="جديد" />
              <Toggle checked={form.onSale} onChange={(v) => patch({ onSale: v })} label="عرض/خصم" />
            </div>
          </Panel>

          <Panel title="الصور" description="الصورة الأولى هي الصورة الرئيسية للمنتج.">
            <ImageUploader
              value={form.images}
              onChange={(urls) => patch({ images: urls })}
              kind="product"
              multiple
              label="صور المنتج"
            />
          </Panel>
        </div>

        {/* المعاينة الحيّة + الإجراءات */}
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <Panel title="معاينة مباشرة">
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              <div className="relative aspect-square w-full bg-cream/50">
                {previewImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewImage} alt={form.name || "معاينة"} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                    لا توجد صورة
                  </div>
                )}
                {discountPercent > 0 ? (
                  <span className="absolute top-2 start-2 rounded-full bg-gold px-2.5 py-1 text-[11px] font-bold text-white">
                    خصم {discountPercent}%
                  </span>
                ) : null}
              </div>
              <div className="space-y-1.5 p-4">
                <p className="line-clamp-2 text-sm font-bold text-ink">
                  {form.name || "اسم المنتج"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold text-gold">
                    {formatMoney(previewPrice, settings)}
                  </span>
                  {toNumber(form.compareAtPrice) > previewPrice && previewPrice > 0 ? (
                    <span className="text-xs text-muted line-through">
                      {formatMoney(toNumber(form.compareAtPrice), settings)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Panel>

          <Panel>
            <div className="space-y-3">
              <button type="submit" disabled={saving} className="btn btn-primary min-h-12 w-full">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                {saving ? "جارٍ الحفظ…" : isEdit ? "حفظ التعديلات" : "إنشاء المنتج"}
              </button>
              <button
                type="button"
                onClick={() => router.push("/admin/products")}
                className="btn btn-outline min-h-12 w-full"
                disabled={saving}
              >
                إلغاء
              </button>
              {isEdit ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="btn min-h-12 w-full border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  disabled={saving || deleting}
                >
                  <Trash2 className="h-5 w-5" /> حذف المنتج
                </button>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="حذف المنتج"
        message="هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء."
        confirmLabel="حذف نهائي"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setConfirmDelete(false)}
      />
    </form>
  );
}
