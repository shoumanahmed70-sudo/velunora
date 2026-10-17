"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import { useStore } from "@/lib/store-provider";
import { formatMoney } from "@/lib/money";
import {
  AdminHeading,
  ConfirmDialog,
  EmptyRow,
  ErrorBlock,
  LoadingBlock,
  Panel,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";
import type { CustomerProfile, Order } from "@/lib/types";

interface DetailResponse {
  profile: CustomerProfile;
  orders: Order[];
}

function formatDateTime(ts: number): string {
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

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-line bg-cream/30 px-4 py-3">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span className="text-sm font-semibold text-ink">{value || "—"}</span>
    </div>
  );
}

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams<{ uid: string }>();
  const uid = params?.uid ?? "";
  const toast = useToast();
  const { me, loading: meLoading } = useMe();
  const { settings } = useStore();

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const perms = me?.admin?.permissions ?? [];
  const allowed = me?.admin?.role === "owner" || perms.includes("customers");

  useEffect(() => {
    if (meLoading) return;
    if (!me?.admin) {
      router.push("/admin/login");
      return;
    }
    if (!allowed) router.push("/admin");
  }, [meLoading, me, allowed, router]);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<DetailResponse>(`/api/admin/customers/${encodeURIComponent(uid)}`);
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل بيانات العميل"));
    } finally {
      setLoading(false);
    }
  }, [uid, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleDisabled() {
    if (!data) return;
    const next = !data.profile.disabled;
    setBusy(true);
    try {
      const res = await api.put<{ profile: CustomerProfile }>(
        `/api/admin/customers/${encodeURIComponent(data.profile.uid)}`,
        { disabled: next }
      );
      setData((prev) => (prev ? { ...prev, profile: res.profile } : prev));
      toast(next ? "تم تعطيل الحساب" : "تم تفعيل الحساب", "success");
      setConfirmOpen(false);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر تحديث حالة الحساب"), "error");
    } finally {
      setBusy(false);
    }
  }

  const profile = data?.profile;
  const orders = data?.orders ?? [];

  return (
    <>
      <AdminHeading
        title={profile?.name ? `العميل: ${profile.name}` : "تفاصيل العميل"}
        description={profile ? `معرّف الحساب: ${profile.uid}` : undefined}
        actions={
          <>
            <Link href="/admin/customers" className="btn btn-ghost">
              رجوع إلى العملاء
            </Link>
            {profile ? (
              <button
                type="button"
                className={profile.disabled ? "btn btn-gold" : "btn bg-red-600 text-white hover:bg-red-700"}
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
              >
                {profile.disabled ? "تفعيل الحساب" : "تعطيل الحساب"}
              </button>
            ) : null}
          </>
        }
      />

      {loading && !data ? (
        <LoadingBlock label="جارٍ تحميل بيانات العميل…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : !profile ? (
        <ErrorBlock message="العميل غير موجود" />
      ) : (
        <div className="space-y-6">
          <Panel title="بيانات الحساب">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <InfoRow label="الاسم" value={profile.name} />
              <InfoRow
                label="البريد الإلكتروني"
                value={
                  <span dir="ltr" className="inline-block">
                    {profile.email}
                  </span>
                }
              />
              <InfoRow
                label="الجوال"
                value={
                  profile.phone ? (
                    <a href={`tel:${profile.phone}`} className="text-primary hover:underline">
                      <span dir="ltr">{profile.phone}</span>
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow label="المدينة" value={profile.city} />
              <InfoRow label="العنوان" value={profile.address} />
              <InfoRow
                label="حالة تأكيد البريد"
                value={
                  <span
                    className={`chip border ${
                      profile.emailVerified
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    }`}
                  >
                    {profile.emailVerified ? "مؤكَّد" : "غير مؤكَّد"}
                  </span>
                }
              />
              <InfoRow
                label="حالة الحساب"
                value={
                  <span
                    className={`chip border ${
                      profile.disabled
                        ? "bg-red-100 text-red-700 border-red-200"
                        : "bg-emerald-100 text-emerald-800 border-emerald-200"
                    }`}
                  >
                    {profile.disabled ? "معطّل" : "نشط"}
                  </span>
                }
              />
              <InfoRow label="تاريخ التسجيل" value={formatDateTime(profile.createdAt)} />
              <InfoRow label="آخر تحديث" value={formatDateTime(profile.updatedAt)} />
            </div>

            <p className="mt-4 rounded-xl border border-line bg-cream/30 px-4 py-3 text-xs leading-6 text-muted">
              تعطيل الحساب يمنع صاحب الحساب من إنشاء طلبات جديدة ومن الدخول إلى حسابه.
              لا يتوفر حذف الحساب أو بياناته من هنا؛ الحذف يتطلب إجراءً رسميًا وصلاحية عليا.
            </p>
          </Panel>

          <Panel title={`طلبات العميل (${orders.length})`}>
            <TableWrap>
              <thead>
                <tr>
                  <Th>رقم الطلب</Th>
                  <Th>التاريخ</Th>
                  <Th>الحالة</Th>
                  <Th>الإجمالي</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <EmptyRow colSpan={5} message="لا توجد طلبات لهذا العميل" />
                ) : (
                  orders.map((o) => (
                    <tr key={o.id} className="transition hover:bg-cream/40">
                      <Td className="font-semibold">
                        <span dir="ltr">#{o.number}</span>
                      </Td>
                      <Td>{formatDateTime(o.createdAt)}</Td>
                      <Td>
                        <StatusBadge status={o.status} />
                      </Td>
                      <Td className="tabular-nums">{formatMoney(o.total, settings)}</Td>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="btn btn-outline px-3 py-1.5 text-xs"
                        >
                          فتح الطلب
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </Panel>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        busy={busy}
        danger={!profile?.disabled}
        title={profile?.disabled ? "تفعيل الحساب" : "تعطيل الحساب"}
        confirmLabel={profile?.disabled ? "تفعيل" : "تعطيل"}
        message={
          profile?.disabled
            ? "سيتمكن صاحب الحساب من الدخول وإنشاء طلبات جديدة مرة أخرى. هل تريد المتابعة؟"
            : "تعطيل الحساب يمنع صاحب الحساب من إنشاء طلبات جديدة ومن الدخول إلى حسابه. هل تريد المتابعة؟"
        }
        onConfirm={() => void toggleDisabled()}
        onClose={() => {
          if (!busy) setConfirmOpen(false);
        }}
      />
    </>
  );
}
