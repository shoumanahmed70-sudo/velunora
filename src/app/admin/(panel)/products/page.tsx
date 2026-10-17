"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Eye, EyeOff, Loader2, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import { ApiError, errorMessage, useApi } from "@/lib/api-client";
import { useStore } from "@/lib/store-provider";
import { useToast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import type { Category, Product } from "@/lib/types";
import {
  AdminHeading,
  ConfirmDialog,
  EmptyRow,
  ErrorBlock,
  LoadingBlock,
  TableWrap,
  Td,
  Th,
  inputCls,
} from "@/components/admin/ui";

type Filter = "all" | "active" | "hidden" | "featured";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "مفعّل" },
  { key: "hidden", label: "مخفي" },
  { key: "featured", label: "مميز" },
];

function productStock(p: Product): number {
  if (p.variants && p.variants.length > 0) {
    return p.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
  }
  return Number(p.stock) || 0;
}

export default function AdminProductsPage() {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const { settings } = useStore();

  const [items, setItems] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of categories) {
      map.set(c.id, c.name);
      map.set(c.slug, c.name);
    }
    return map;
  }, [categories]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: Product[] }>("/api/admin/products");
      setItems(res.items ?? []);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل المنتجات"));
    } finally {
      setLoading(false);
    }
  }, [api, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<{ items?: Category[]; categories?: Category[] }>(
          "/api/admin/categories"
        );
        if (alive) setCategories(res.items ?? res.categories ?? []);
      } catch {
        if (alive) setCategories([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((p) => {
        if (filter === "active" && !p.active) return false;
        if (filter === "hidden" && p.active) return false;
        if (filter === "featured" && !p.featured) return false;
        if (!q) return true;
        return (
          (p.name || "").toLowerCase().includes(q) ||
          (p.nameEn || "").toLowerCase().includes(q) ||
          (p.slug || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
  }, [items, query, filter]);

  async function toggleField(p: Product, field: "active" | "featured") {
    const key = `${p.id}:${field}`;
    if (busy[key]) return;
    setBusy((prev) => ({ ...prev, [key]: true }));
    try {
      const res = await api.put<{ product: Product }>(`/api/admin/products/${p.id}`, {
        [field]: !p[field],
      });
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== p.id) return item;
          if (res.product) return res.product;
          const fallback: Product = { ...item };
          if (field === "active") fallback.active = !p.active;
          else fallback.featured = !p.featured;
          return fallback;
        })
      );
      toast(field === "active" ? "تم تحديث حالة العرض" : "تم تحديث التمييز", "success");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر التحديث"), "error");
    } finally {
      setBusy((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  }

  async function handleDelete() {
    if (!toDelete || deleting) return;
    setDeleting(true);
    try {
      await api.del(`/api/admin/products/${toDelete.id}`);
      setItems((prev) => prev.filter((p) => p.id !== toDelete.id));
      toast("تم حذف المنتج", "success");
      setToDelete(null);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حذف المنتج"), "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <AdminHeading
        title="المنتجات"
        description="إدارة كاملة لمنتجات المتجر، بما فيها غير المفعّلة."
        actions={
          <Link href="/admin/products/new" className="btn btn-primary min-h-11 px-5 py-2.5 text-sm">
            <Plus className="h-4 w-4" /> منتج جديد
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الرابط…"
            className={`${inputCls} ps-9`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
                filter === f.key
                  ? "border-gold bg-gold/15 text-ink"
                  : "border-line bg-white text-muted hover:bg-cream"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="جارٍ تحميل المنتجات…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <Th>الصورة</Th>
              <Th>الاسم</Th>
              <Th>القسم</Th>
              <Th>السعر</Th>
              <Th>المخزون</Th>
              <Th>مفعّل</Th>
              <Th>مميز</Th>
              <Th>إجراءات</Th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <EmptyRow colSpan={8} message="لا توجد منتجات مطابقة" />
            ) : (
              visible.map((p) => {
                const activeKey = `${p.id}:active`;
                const featuredKey = `${p.id}:featured`;
                return (
                  <tr key={p.id}>
                    <Td>
                      <div className="h-12 w-12 overflow-hidden rounded-lg border border-line bg-cream/50">
                        {p.images?.[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0]} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                        ) : null}
                      </div>
                    </Td>
                    <Td>
                      <div className="font-semibold text-ink">{p.name}</div>
                      <div className="text-xs text-muted" dir="ltr">
                        {p.slug}
                      </div>
                    </Td>
                    <Td>{categoryNames.get(p.category) || p.category || "—"}</Td>
                    <Td>
                      <div className="font-semibold">{formatMoney(p.price, settings)}</div>
                      {p.compareAtPrice && p.compareAtPrice > p.price ? (
                        <div className="text-xs text-muted line-through">
                          {formatMoney(p.compareAtPrice, settings)}
                        </div>
                      ) : null}
                    </Td>
                    <Td>
                      <span
                        className={`chip border ${
                          productStock(p) > 0
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        {productStock(p)}
                      </span>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => void toggleField(p, "active")}
                        disabled={busy[activeKey]}
                        title={p.active ? "إخفاء من المتجر" : "إظهار في المتجر"}
                        className={`btn px-3 py-1.5 text-xs ${
                          p.active
                            ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border border-line bg-cream text-muted"
                        }`}
                      >
                        {busy[activeKey] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : p.active ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                        {p.active ? "ظاهر" : "مخفي"}
                      </button>
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => void toggleField(p, "featured")}
                        disabled={busy[featuredKey]}
                        title={p.featured ? "إزالة التمييز" : "تمييز المنتج"}
                        className={`btn px-3 py-1.5 text-xs ${
                          p.featured
                            ? "border border-gold bg-gold/15 text-ink"
                            : "border border-line bg-cream text-muted"
                        }`}
                      >
                        {busy[featuredKey] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Star className={`h-4 w-4 ${p.featured ? "fill-gold text-gold" : ""}`} />
                        )}
                        {p.featured ? "مميز" : "عادي"}
                      </button>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="btn btn-outline px-3 py-1.5 text-xs"
                          title="تعديل"
                        >
                          <Pencil className="h-4 w-4" /> تعديل
                        </Link>
                        <a
                          href={`/product/${p.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-ghost border border-line px-3 py-1.5 text-xs"
                          title="عرض في المتجر"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setToDelete(p)}
                          className="btn btn-ghost border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                          title="حذف"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </Td>
                  </tr>
                );
              })
            )}
          </tbody>
        </TableWrap>
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="حذف المنتج"
        message={`هل تريد حذف «${toDelete?.name ?? ""}» نهائيًا؟ لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel="حذف نهائي"
        danger
        busy={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
