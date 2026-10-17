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
import type { AdminDoc, AdminPermission, AdminRole } from "@/lib/types";

const ALL_PERMISSIONS: Array<{ value: AdminPermission; label: string }> = [
  { value: "products", label: "المنتجات" },
  { value: "orders", label: "الطلبات" },
  { value: "customers", label: "العملاء" },
  { value: "settings", label: "الإعدادات" },
  { value: "home", label: "الصفحة الرئيسية" },
  { value: "pages", label: "الصفحات" },
  { value: "audit", label: "سجل التدقيق" },
];

interface StaffForm {
  uid: string;
  email: string;
  name: string;
  role: AdminRole;
  permissions: AdminPermission[];
  active: boolean;
}

const EMPTY_FORM: StaffForm = {
  uid: "",
  email: "",
  name: "",
  role: "staff",
  permissions: [],
  active: true,
};

function formatDateTime(ts: number | null): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(ts));
  } catch {
    return "—";
  }
}

export default function StaffPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [items, setItems] = useState<AdminDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminDoc | null>(null);
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AdminDoc | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isOwner = me?.admin?.role === "owner";
  const selfUid = me?.user?.uid ?? null;

  useEffect(() => {
    if (meLoading) return;
    if (!me?.admin) {
      router.push("/admin/login");
      return;
    }
    if (!isOwner) {
      setForbidden(true);
      router.push("/admin");
    }
  }, [meLoading, me, isOwner, router]);

  const load = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: AdminDoc[] }>("/api/admin/staff");
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل المدراء"));
    } finally {
      setLoading(false);
    }
  }, [isOwner, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownerCount = items.filter((a) => a.role === "owner").length;
  const isLastOwner = (a: AdminDoc | null): boolean =>
    Boolean(a && a.role === "owner" && ownerCount === 1);
  const isSelf = (a: AdminDoc | null): boolean => Boolean(a && selfUid && a.uid === selfUid);

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(a: AdminDoc) {
    setEditing(a);
    setForm({
      uid: a.uid,
      email: a.email,
      name: a.name,
      role: a.role,
      permissions: [...a.permissions],
      active: a.active,
    });
    setModalOpen(true);
  }

  function togglePermission(p: AdminPermission) {
    setForm((f) => ({
      ...f,
      permissions: f.permissions.includes(p)
        ? f.permissions.filter((x) => x !== p)
        : [...f.permissions, p],
    }));
  }

  async function submit() {
    if (!form.uid.trim()) {
      toast("معرّف الحساب (UID) مطلوب", "error");
      return;
    }
    if (!form.email.trim()) {
      toast("البريد الإلكتروني مطلوب", "error");
      return;
    }
    if (editing && isLastOwner(editing) && (form.role !== "owner" || !form.active)) {
      toast("لا يمكن تخفيض أو تعطيل آخر مالك في النظام", "error");
      return;
    }
    if (editing && isSelf(editing) && !form.active) {
      toast("لا يمكنك إلغاء حسابك الخاص", "error");
      return;
    }

    const payload = {
      uid: form.uid.trim(),
      email: form.email.trim(),
      name: form.name.trim(),
      role: form.role,
      permissions: form.permissions,
      active: form.active,
    };

    setBusy(true);
    try {
      if (editing) {
        await api.put(`/api/admin/staff/${encodeURIComponent(editing.uid)}`, payload);
        toast("تم تحديث حساب المدير", "success");
      } else {
        await api.post("/api/admin/staff", payload);
        toast("تمت إضافة المدير", "success");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ حساب المدير"), "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (isLastOwner(deleteTarget)) {
      toast("لا يمكن حذف آخر مالك في النظام", "error");
      return;
    }
    if (isSelf(deleteTarget)) {
      toast("لا يمكنك حذف حسابك الخاص", "error");
      return;
    }
    setDeleting(true);
    try {
      await api.del(`/api/admin/staff/${encodeURIComponent(deleteTarget.uid)}`);
      toast("تم إلغاء حساب المدير", "success");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حذف حساب المدير"), "error");
    } finally {
      setDeleting(false);
    }
  }

  if (meLoading || (!isOwner && !forbidden)) {
    return <LoadingBlock label="جارٍ التحقق من الصلاحيات…" />;
  }

  if (!isOwner) {
    return <ErrorBlock message="هذه الصفحة متاحة للمالك فقط" />;
  }

  const editingLastOwner = isLastOwner(editing);

  return (
    <>
      <AdminHeading
        title="الموظفون"
        description="إدارة حسابات المدراء وصلاحياتهم (owner فقط)"
        actions={
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            إضافة مدير
          </button>
        }
      />

      <p className="mb-5 rounded-xl border border-line bg-cream/40 px-4 py-3 text-xs leading-6 text-muted">
        لإضافة موظف يجب أن يملك حسابًا مسجَّلًا مسبقًا في الموقع؛ أدخل معرّف الحساب (UID) وبريده
        الإلكتروني. بديلًا، يمكنك استخدام سكربت الخادم <span dir="ltr">npm run admin:create</span>. لا
        يوجد تسجيل مدير عام من الموقع.
      </p>

      <Panel>
        {loading && items.length === 0 ? (
          <LoadingBlock label="جارٍ تحميل المدراء…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>الاسم</Th>
                <Th>البريد الإلكتروني</Th>
                <Th>الدور</Th>
                <Th>الصلاحيات</Th>
                <Th>الحالة</Th>
                <Th>آخر دخول</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={7} message="لا يوجد مدراء" />
              ) : (
                items.map((a) => (
                  <tr key={a.uid} className="transition hover:bg-cream/40">
                    <Td className="font-semibold">
                      {a.name || "—"}
                      {isSelf(a) ? <span className="ms-2 text-xs text-muted">(أنت)</span> : null}
                    </Td>
                    <Td>
                      <span dir="ltr">{a.email}</span>
                    </Td>
                    <Td>
                      <span
                        className={`chip border ${
                          a.role === "owner"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {a.role === "owner" ? "مالك" : "موظف"}
                      </span>
                    </Td>
                    <Td>
                      {a.role === "owner" ? (
                        <span className="text-xs text-muted">كل الصلاحيات</span>
                      ) : a.permissions.length === 0 ? (
                        <span className="text-xs text-muted">لا صلاحيات</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {a.permissions.map((p) => (
                            <span key={p} className="chip border border-line bg-cream/60 text-ink">
                              {ALL_PERMISSIONS.find((x) => x.value === p)?.label ?? p}
                            </span>
                          ))}
                        </div>
                      )}
                    </Td>
                    <Td>
                      <span
                        className={`chip border ${
                          a.active
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-red-100 text-red-700 border-red-200"
                        }`}
                      >
                        {a.active ? "نشط" : "معطّل"}
                      </span>
                    </Td>
                    <Td>{formatDateTime(a.lastLoginAt)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn btn-outline px-3 py-1.5 text-xs"
                          onClick={() => openEdit(a)}
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="btn px-3 py-1.5 text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                          onClick={() => setDeleteTarget(a)}
                          disabled={isLastOwner(a) || isSelf(a)}
                          title={
                            isLastOwner(a)
                              ? "لا يمكن حذف آخر مالك"
                              : isSelf(a)
                                ? "لا يمكنك حذف حسابك"
                                : undefined
                          }
                        >
                          إلغاء
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
        title={editing ? "تعديل مدير" : "إضافة مدير"}
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
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              disabled={busy || (editingLastOwner && form.role !== "owner")}
            >
              {busy ? "جارٍ الحفظ…" : "حفظ"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {editingLastOwner ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
              هذا هو آخر مالك في النظام؛ لا يمكن تخفيض دوره أو تعطيله أو حذفه.
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="معرّف الحساب (UID)" required hint={editing ? "لا يمكن تعديل المعرّف" : undefined}>
              <input
                className={inputCls}
                dir="ltr"
                value={form.uid}
                disabled={Boolean(editing)}
                onChange={(e) => setForm({ ...form, uid: e.target.value })}
              />
            </Field>
            <Field label="البريد الإلكتروني" required>
              <input
                className={inputCls}
                dir="ltr"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
            <Field label="الاسم" className="sm:col-span-2">
              <input
                className={inputCls}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
          </div>

          <Field label="الدور">
            <select
              className={inputCls}
              value={form.role}
              disabled={editingLastOwner}
              onChange={(e) => setForm({ ...form, role: e.target.value as AdminRole })}
            >
              <option value="owner">مالك (كل الصلاحيات)</option>
              <option value="staff">موظف</option>
            </select>
          </Field>

          {form.role === "staff" ? (
            <div>
              <span className="mb-1.5 block text-sm font-semibold text-ink">الصلاحيات</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {ALL_PERMISSIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2.5 text-sm font-semibold text-ink hover:bg-cream/50"
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--vc-primary)]"
                      checked={form.permissions.includes(p.value)}
                      onChange={() => togglePermission(p.value)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          <Toggle
            checked={form.active}
            onChange={(v) => {
              if (editingLastOwner && !v) return;
              if (editing && isSelf(editing) && !v) return;
              setForm({ ...form, active: v });
            }}
            label="الحساب نشط"
          />
          {editing && isSelf(editing) ? (
            <p className="text-xs text-muted">لا يمكنك تعطيل حسابك أو حذفه.</p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        busy={deleting}
        danger
        title="إلغاء حساب مدير"
        confirmLabel="إلغاء الحساب"
        message={`سيتم إلغاء وصول «${deleteTarget?.name || deleteTarget?.email || ""}» إلى لوحة الإدارة. هل تريد المتابعة؟`}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
      />
    </>
  );
}
