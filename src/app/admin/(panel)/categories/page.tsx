"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import {
  AdminHeading,
  ConfirmDialog,
  EmptyRow,
  ErrorBlock,
  Field,
  LoadingBlock,
  Modal,
  Panel,
  TableWrap,
  Td,
  Th,
  Toggle,
  inputCls,
} from "@/components/admin/ui";
import type { Category } from "@/lib/types";

interface CategoryForm {
  name: string;
  nameEn: string;
  slug: string;
  order: number;
  active: boolean;
}

const EMPTY_FORM: CategoryForm = { name: "", nameEn: "", slug: "", order: 0, active: true };

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function CategoriesPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const perms = me?.admin?.permissions ?? [];
  const allowed = me?.admin?.role === "owner" || perms.includes("products");

  useEffect(() => {
    if (meLoading) return;
    if (!me?.admin) {
      router.push("/admin/login");
      return;
    }
    if (!allowed) router.push("/admin");
  }, [meLoading, me, allowed, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: Category[] }>("/api/admin/categories");
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل الأقسام"));
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      nameEn: c.nameEn,
      slug: c.slug,
      order: c.order,
      active: c.active,
    });
    setModalOpen(true);
  }

  async function submit() {
    const name = form.name.trim();
    if (!name) {
      toast("اسم القسم مطلوب", "error");
      return;
    }
    const slug = (form.slug.trim() || slugify(form.nameEn) || slugify(name) || `cat-${Date.now()}`).toLowerCase();
    const payload = {
      name,
      nameEn: form.nameEn.trim(),
      slug,
      order: Number.isFinite(form.order) ? form.order : 0,
      active: form.active,
    };
    setBusy(true);
    try {
      if (editing) {
        await api.put(`/api/admin/categories/${encodeURIComponent(editing.id)}`, payload);
        toast("تم تحديث القسم", "success");
      } else {
        await api.post("/api/admin/categories", payload);
        toast("تم إنشاء القسم", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ القسم"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.del(`/api/admin/categories/${encodeURIComponent(deleteTarget.id)}`);
      toast("تم حذف القسم", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حذف القسم"), "error");
    } finally {
      setDeleting(false);
    }
  }

  const sorted = [...items].sort((a, b) => a.order - b.order);

  return (
    <>
      <AdminHeading
        title="الأقسام"
        description="تصنيفات المنتجات الظاهرة في المتجر"
        actions={
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            إضافة قسم
          </button>
        }
      />

      <Panel>
        {loading && items.length === 0 ? (
          <LoadingBlock label="جارٍ تحميل الأقسام…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>الاسم بالإنجليزية</Th>
                <Th>الرابط (slug)</Th>
                <Th>الترتيب</Th>
                <Th>مفعّل</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <EmptyRow colSpan={6} message="لا توجد أقسام" />
              ) : (
                sorted.map((c) => (
                  <tr key={c.id} className="transition hover:bg-cream/40">
                    <Td className="font-semibold">{c.name || "—"}</Td>
                    <Td>
                      <span dir="ltr">{c.nameEn || "—"}</span>
                    </Td>
                    <Td>
                      <span dir="ltr" className="text-muted">
                        {c.slug}
                      </span>
                    </Td>
                    <Td className="tabular-nums">{c.order}</Td>
                    <Td>
                      <span
                        className={`chip border ${
                          c.active
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {c.active ? "مفعّل" : "معطّل"}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline px-3 py-1.5 text-xs"
                          onClick={() => openEdit(c)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="btn px-3 py-1.5 text-xs bg-red-600 text-white hover:bg-red-700"
                          onClick={() => setDeleteTarget(c)}
                        >
                          حذف
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>
        )}
      </Panel>

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!busy) setModalOpen(false);
        }}
        title={editing ? "تعديل القسم" : "إضافة قسم"}
        footer={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setModalOpen(false)}
              disabled={busy}
            >
              إلغاء
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void submit()} disabled={busy}>
              {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="الاسم (عربي)" required>
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="الاسم (إنجليزي)">
            <input
              className={inputCls}
              dir="ltr"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
            />
          </Field>
          <Field label="الرابط (slug)" hint="يُولَّد تلقائيًا من الاسم الإنجليزي إن تُرك فارغًا">
            <input
              className={inputCls}
              dir="ltr"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="men-women"
            />
          </Field>
          <Field label="الترتيب">
            <input
              type="number"
              className={inputCls}
              value={form.order}
              onChange={(e) => {
                const n = Number(e.target.value);
                setForm({ ...form, order: Number.isFinite(n) ? n : 0 });
              }}
            />
          </Field>
          <Toggle
            checked={form.active}
            onChange={(v) => setForm({ ...form, active: v })}
            label="مفعّل"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={deleting}
        danger
        title="حذف القسم"
        confirmLabel="حذف"
        message={`سيتم حذف القسم «${deleteTarget?.name ?? ""}». المنتجات المرتبطة به لن تُحذف، لكنها ستفقد تصنيفها. هل تريد المتابعة؟`}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </>
  );
}
