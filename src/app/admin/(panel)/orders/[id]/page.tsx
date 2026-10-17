"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, ClipboardCopy, Loader2, Mail, MessageCircle, Phone, Printer, Receipt, Save, Send } from "lucide-react";
import { ApiError, errorMessage, useApi } from "@/lib/api-client";
import { useStore } from "@/lib/store-provider";
import { useToast } from "@/lib/toast";
import { digitsOnly, formatMoney } from "@/lib/money";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/order-status";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";
import {
  AdminHeading,
  EmptyRow,
  ErrorBlock,
  Field,
  LoadingBlock,
  Panel,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  inputCls,
} from "@/components/admin/ui";

interface OrderDetailResponse {
  order: Order;
  waUrl: string;
  waMessage: string;
  /** نص الفاتورة الجاهز + رابط واتساب إلى جوال العميل (إن توفر رقم صالح). */
  invoiceMessage?: string;
  invoiceWaUrl?: string;
}

function arabicDateTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "full", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

function optionsText(options: Record<string, string> | null | undefined): string {
  if (!options) return "—";
  const entries = Object.entries(options).filter(([, v]) => v);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k}: ${v}`).join(" · ");
}

/** يبني رابط تواصل إداري مع العميل عبر واتساب من بياناته المسجّلة. */
function customerWaUrl(order: Order): string {
  const phone = (order.customer?.phone || "").replace(/[^\d]/g, "");
  const message = `مرحبًا ${order.customer?.name || ""}، بخصوص طلبك رقم ${order.number} من متجرنا.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function AdminOrderDetailPage() {
  const api = useApi();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  const toast = useToast();
  const { settings } = useStore();

  const [data, setData] = useState<OrderDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusDraft, setStatusDraft] = useState<OrderStatus>("new");
  const [savingStatus, setSavingStatus] = useState(false);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [sendingInvoice, setSendingInvoice] = useState(false);

  const handleErr = useCallback(
    (err: unknown, fallback: string): void => {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, fallback), "error");
    },
    [router, toast]
  );

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<OrderDetailResponse>(`/api/admin/orders/${id}`);
      setData(res);
      setStatusDraft(res.order.status);
      setNotesDraft(res.order.internalNotes || "");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل تفاصيل الطلب"));
    } finally {
      setLoading(false);
    }
  }, [api, id, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const order = data?.order ?? null;

  const waCustomer = useMemo(() => (order ? customerWaUrl(order) : ""), [order]);
  const telHref = order?.customer?.phone ? `tel:${digitsOnly(order.customer.phone)}` : "";

  async function saveStatus() {
    if (!order || savingStatus) return;
    if (statusDraft === order.status) {
      toast("الحالة لم تتغيّر", "info");
      return;
    }
    setSavingStatus(true);
    try {
      const res = await api.put<OrderDetailResponse>(`/api/admin/orders/${order.id}`, {
        status: statusDraft,
      });
      setData(res);
      setStatusDraft(res.order.status);
      if (res.order.internalNotes !== undefined) setNotesDraft(res.order.internalNotes || "");
      toast("تم تحديث حالة الطلب", "success");
    } catch (err) {
      handleErr(err, "تعذّر تحديث الحالة");
    } finally {
      setSavingStatus(false);
    }
  }

  async function saveNotes() {
    if (!order || savingNotes) return;
    setSavingNotes(true);
    try {
      const res = await api.put<OrderDetailResponse>(`/api/admin/orders/${order.id}`, {
        internalNotes: notesDraft,
      });
      setData(res);
      if (res.order.internalNotes !== undefined) setNotesDraft(res.order.internalNotes || "");
      toast("تم حفظ الملاحظات الداخلية", "success");
    } catch (err) {
      handleErr(err, "تعذّر حفظ الملاحظات");
    } finally {
      setSavingNotes(false);
    }
  }

  function openAdminWhatsapp() {
    if (!data?.waUrl) {
      toast("لا يتوفر رابط واتساب لهذا الطلب", "error");
      return;
    }
    window.open(data.waUrl, "_blank", "noopener,noreferrer");
  }

  async function copyMessage() {
    if (!data?.waMessage) return;
    try {
      await navigator.clipboard.writeText(data.waMessage);
      toast("تم نسخ نص الطلب", "success");
    } catch {
      toast("تعذّر النسخ، انسخ النص يدويًا", "error");
    }
  }

  /** ينتظر تحميل صور الفاتورة ثم يطبع — وإلا ظهرت مربعات فارغة في الورقة. */
  function printInvoice() {
    const doPrint = () => {
      document.body.classList.add("printing-invoice");
      const cleanup = () => {
        document.body.classList.remove("printing-invoice");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
    };

    const pending = Array.from(
      document.querySelectorAll<HTMLImageElement>(".invoice-print img")
    ).filter((img) => !img.complete);
    if (pending.length === 0) {
      doPrint();
      return;
    }
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            window.setTimeout(done, 1500);
          })
      )
    ).then(doPrint);
  }

  async function emailInvoice() {
    if (!order || sendingInvoice) return;
    setSendingInvoice(true);
    try {
      const res = await api.post<{ sent: boolean; reason?: string; to: string }>(
        `/api/admin/orders/${order.id}/invoice`,
        {}
      );
      if (res.sent) {
        toast(`تم إرسال الفاتورة إلى ${res.to}`, "success");
      } else if (res.reason === "disabled") {
        toast("خدمة البريد غير مُفعّلة — فعّلها من الإعدادات ← واتساب والبريد", "error");
      } else {
        toast("تعذّر إرسال الفاتورة، حاول لاحقًا", "error");
      }
    } catch (err) {
      handleErr(err, "تعذّر إرسال الفاتورة");
    } finally {
      setSendingInvoice(false);
    }
  }

  function openInvoiceWhatsapp() {
    if (!data?.invoiceWaUrl) {
      toast("لا يتوفر رقم جوال صالح للعميل", "error");
      return;
    }
    window.open(data.invoiceWaUrl, "_blank", "noopener,noreferrer");
  }

  async function copyInvoiceMessage() {
    if (!data?.invoiceMessage) return;
    try {
      await navigator.clipboard.writeText(data.invoiceMessage);
      toast("تم نسخ نص الفاتورة", "success");
    } catch {
      toast("تعذّر النسخ، انسخ النص يدويًا", "error");
    }
  }

  if (loading) return <LoadingBlock label="جارٍ تحميل تفاصيل الطلب…" />;
  if (error) return <ErrorBlock message={error} onRetry={() => void load()} />;
  if (!order) return <ErrorBlock message="الطلب غير موجود" />;

  return (
    <div>
      <AdminHeading
        title={`الطلب ${order.number}`}
        description={arabicDateTime(order.createdAt)}
        actions={
          <>
            <Link
              href="/admin/orders"
              className="btn btn-ghost min-h-11 border border-line px-4 py-2 text-sm no-print"
            >
              <ArrowRight className="h-4 w-4" /> كل الطلبات
            </Link>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-outline min-h-11 px-5 py-2.5 text-sm no-print"
            >
              <Printer className="h-4 w-4" /> طباعة ملخص الطلب
            </button>
          </>
        }
      />

      <div className="space-y-6">
        {/* الحالة + واتساب + النسخ */}
        <Panel
          title="حالة الطلب"
          actions={<StatusBadge status={order.status} />}
          className="no-print"
        >
          <div className="grid gap-4 sm:grid-cols-[16rem_auto] sm:items-end">
            <Field label="تغيير الحالة">
              <select
                className={inputCls}
                value={statusDraft}
                onChange={(e) => setStatusDraft(e.target.value as OrderStatus)}
                disabled={savingStatus}
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void saveStatus()}
                disabled={savingStatus}
                className="btn btn-primary min-h-11 px-5 py-2.5 text-sm"
              >
                {savingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الحالة
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
            <button
              type="button"
              onClick={openAdminWhatsapp}
              className="btn border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100"
            >
              <MessageCircle className="h-4 w-4" /> فتح محادثة واتساب المدير مع ملخص الطلب
            </button>
            <button
              type="button"
              onClick={() => void copyMessage()}
              className="btn btn-ghost border border-line px-5 py-2.5 text-sm"
            >
              <ClipboardCopy className="h-4 w-4" /> نسخ نص الطلب
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-amber-700">
            تنبيه: فتح واتساب لا يعني الإرسال — يجب الضغط على «إرسال» داخل التطبيق.
          </p>
        </Panel>

        {/* المنتجات */}
        <Panel title="منتجات الطلب">
          <TableWrap>
            <thead>
              <tr>
                <Th>المنتج</Th>
                <Th>الحجم</Th>
                <Th>الخيارات</Th>
                <Th>الكمية</Th>
                <Th>سعر الوحدة</Th>
                <Th>الإجمالي</Th>
              </tr>
            </thead>
            <tbody>
              {order.items.length === 0 ? (
                <EmptyRow colSpan={6} message="لا توجد منتجات في هذا الطلب" />
              ) : (
                order.items.map((it, index) => (
                  <tr key={`${it.productId}-${it.variantId ?? index}`}>
                    <Td>
                      <div className="flex items-center gap-3">
                        {it.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.image}
                            alt={it.name}
                            className="h-11 w-11 rounded-lg border border-line object-cover"
                            loading="lazy"
                          />
                        ) : null}
                        <span className="font-semibold">{it.name}</span>
                      </div>
                    </Td>
                    <Td>{it.variantLabel || "—"}</Td>
                    <Td className="text-xs text-muted">{optionsText(it.options)}</Td>
                    <Td>{it.qty}</Td>
                    <Td>{formatMoney(it.unitPrice, settings)}</Td>
                    <Td className="font-semibold">{formatMoney(it.total, settings)}</Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          {/* المجاميع */}
          <div className="mt-5 ms-auto w-full max-w-sm space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">المجموع الفرعي</span>
              <span className="font-semibold">{formatMoney(order.subtotal, settings)}</span>
            </div>
            {order.discount > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted">الخصم</span>
                <span className="font-semibold text-emerald-700">- {formatMoney(order.discount, settings)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <span className="text-muted">الشحن</span>
              <span className="font-semibold">{formatMoney(order.shipping, settings)}</span>
            </div>
            {order.tax > 0 ? (
              <div className="flex items-center justify-between">
                <span className="text-muted">الضريبة</span>
                <span className="font-semibold">{formatMoney(order.tax, settings)}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-line pt-2 text-base">
              <span className="font-bold">الإجمالي</span>
              <span className="font-extrabold text-gold">{formatMoney(order.total, settings)}</span>
            </div>
          </div>
        </Panel>

        {/* الفاتورة */}
        <Panel
          title="الفاتورة"
          description="اطبع فاتورة رسمية، أو أرسلها للعميل عبر البريد أو واتساب."
          actions={
            <button
              type="button"
              onClick={printInvoice}
              className="btn btn-outline no-print px-4 py-2 text-sm"
            >
              <Printer className="h-4 w-4" /> طباعة الفاتورة
            </button>
          }
        >
          <div className="mb-3 flex flex-wrap gap-2 no-print">
            <button
              type="button"
              onClick={() => void emailInvoice()}
              disabled={sendingInvoice}
              className="btn btn-primary px-5 py-2.5 text-sm"
            >
              {sendingInvoice ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              إرسال الفاتورة بالبريد
              {order.customer?.email ? <span dir="ltr" className="text-xs opacity-80">({order.customer.email})</span> : null}
            </button>
            <button
              type="button"
              onClick={openInvoiceWhatsapp}
              className="btn border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100"
            >
              <Send className="h-4 w-4" /> إرسال الفاتورة واتساب للعميل
            </button>
            <button
              type="button"
              onClick={() => void copyInvoiceMessage()}
              className="btn btn-ghost border border-line px-5 py-2.5 text-sm"
            >
              <ClipboardCopy className="h-4 w-4" /> نسخ نص الفاتورة
            </button>
          </div>
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900 no-print">
            تنبيه: فتح واتساب لا يعني الإرسال — يجب الضغط على «إرسال» داخل التطبيق. إرسال البريد يتطلب تفعيل
            SMTP من الإعدادات ← «واتساب والبريد».
          </p>
          <InvoiceDocument order={order} settings={settings} />
        </Panel>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* بيانات العميل */}
          <Panel title="بيانات العميل">
            <dl className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">الاسم</dt>
                <dd className="font-semibold text-ink">{order.customer?.name || "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">الجوال</dt>
                <dd className="font-semibold text-ink" dir="ltr">
                  {order.customer?.phone ? (
                    <a href={telHref} className="text-primary hover:underline">
                      {order.customer.phone}
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">المدينة</dt>
                <dd className="font-semibold text-ink">{order.customer?.city || "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">العنوان</dt>
                <dd className="text-end font-semibold text-ink">{order.customer?.address || "—"}</dd>
              </div>
              {order.customer?.email ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted">البريد</dt>
                  <dd className="font-semibold text-ink" dir="ltr">
                    {order.customer.email}
                  </dd>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">ملاحظات العميل</dt>
                <dd className="text-end text-ink">{order.customer?.notes || "—"}</dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-5">
              {telHref ? (
                <a href={telHref} className="btn btn-outline px-5 py-2.5 text-sm">
                  <Phone className="h-4 w-4" /> اتصال
                </a>
              ) : null}
              <a
                href={waCustomer}
                target="_blank"
                rel="noreferrer"
                className="btn border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm text-emerald-700 hover:bg-emerald-100"
              >
                <MessageCircle className="h-4 w-4" /> مراسلة العميل واتساب
              </a>
            </div>
          </Panel>

          {/* الملاحظات الداخلية */}
          <Panel title="ملاحظات داخلية" description="لا تظهر للعميل مطلقًا." className="no-print">
            <textarea
              className={`${inputCls} min-h-36`}
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="ملاحظات لفريق العمل حول هذا الطلب…"
            />
            <div className="mt-3 text-end">
              <button
                type="button"
                onClick={() => void saveNotes()}
                disabled={savingNotes}
                className="btn btn-primary min-h-11 px-5 py-2.5 text-sm"
              >
                {savingNotes ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ الملاحظات
              </button>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
