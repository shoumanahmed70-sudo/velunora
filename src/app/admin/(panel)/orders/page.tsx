"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Eye, MessageCircle, Printer, Search } from "lucide-react";
import { ApiError, errorMessage, useApi } from "@/lib/api-client";
import { useStore } from "@/lib/store-provider";
import { useToast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/order-status";
import {
  AdminHeading,
  EmptyRow,
  ErrorBlock,
  LoadingBlock,
  Pagination,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  inputCls,
} from "@/components/admin/ui";

type StatusFilter = OrderStatus | "all";

function arabicDateTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

interface OrdersResponse {
  items: (Order & { waUrl: string })[];
  total: number;
  page: number;
  pageSize: number;
}

interface StatsLite {
  statusCounts: Record<OrderStatus, number>;
}

const PAGE_SIZE = 20;

export default function AdminOrdersPage() {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const { settings } = useStore();

  const [items, setItems] = useState<(Order & { waUrl: string })[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [statusCounts, setStatusCounts] = useState<Record<OrderStatus, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // قراءة فلتر الحالة من الرابط (?status=) عند الفتح
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("status");
    if (s && (ORDER_STATUSES as string[]).includes(s)) setStatus(s as OrderStatus);
  }, []);

  // تأجيل البحث النصي
  useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (status !== "all") params.set("status", status);
      if (query) params.set("q", query);
      params.set("page", String(page));
      params.set("pageSize", String(PAGE_SIZE));
      const res = await api.get<OrdersResponse>(`/api/admin/orders?${params.toString()}`);
      setItems(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل الطلبات"));
    } finally {
      setLoading(false);
    }
  }, [api, page, query, router, status, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<StatsLite>("/api/admin/stats");
        if (alive) setStatusCounts(res.statusCounts ?? null);
      } catch {
        if (alive) setStatusCounts(null);
      }
    })();
    return () => {
      alive = false;
    };
  }, [api]);

  const tabs = useMemo(() => {
    const allCount = statusCounts
      ? ORDER_STATUSES.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0)
      : null;
    return [
      { key: "all" as StatusFilter, label: "الكل", count: allCount },
      ...ORDER_STATUSES.map((s) => ({
        key: s as StatusFilter,
        label: STATUS_LABELS[s],
        count: statusCounts ? statusCounts[s] ?? 0 : null,
      })),
    ];
  }, [statusCounts]);

  function exportCsv() {
    const params = new URLSearchParams();
    params.set("format", "csv");
    if (status !== "all") params.set("status", status);
    if (query) params.set("q", query);
    window.location.href = `/api/admin/orders/export?${params.toString()}`;
  }

  function whatsapp(o: Order & { waUrl: string }) {
    if (!o.waUrl) {
      toast("لا يتوفر رابط واتساب لهذا الطلب", "error");
      return;
    }
    window.open(o.waUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <AdminHeading
        title="الطلبات"
        description="تابع الطلبات وحدّث حالتها وتواصل مع العملاء."
        actions={
          <>
            <button type="button" onClick={exportCsv} className="btn btn-outline min-h-11 px-5 py-2.5 text-sm no-print">
              <Download className="h-4 w-4" /> تصدير CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-ghost min-h-11 border border-line px-5 py-2.5 text-sm no-print"
            >
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </>
        }
      />

      {/* تبويبات الحالات */}
      <div className="mb-4 flex flex-wrap gap-2 no-print">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setStatus(t.key);
              setPage(1);
            }}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold transition ${
              status === t.key
                ? "border-gold bg-gold/15 text-ink"
                : "border-line bg-white text-muted hover:bg-cream"
            }`}
          >
            {t.label}
            {t.count !== null ? (
              <span className="ms-2 rounded-full bg-cream px-2 py-0.5 text-xs text-ink">{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mb-4 relative max-w-md no-print">
        <Search className="pointer-events-none absolute top-1/2 start-3 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="ابحث برقم الطلب أو اسم العميل أو الجوال…"
          className={`${inputCls} ps-9`}
        />
      </div>

      {loading ? (
        <LoadingBlock label="جارٍ تحميل الطلبات…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : (
        <div>
          <TableWrap>
            <thead>
              <tr>
                <Th>رقم الطلب</Th>
                <Th>التاريخ</Th>
                <Th>العميل</Th>
                <Th>الجوال</Th>
                <Th>المدينة</Th>
                <Th>الإجمالي</Th>
                <Th>الحالة</Th>
                <Th className="no-print">إجراءات</Th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={8} message="لا توجد طلبات مطابقة" />
              ) : (
                items.map((o) => (
                  <tr key={o.id}>
                    <Td className="font-bold">{o.number}</Td>
                    <Td className="text-xs text-muted">{arabicDateTime(o.createdAt)}</Td>
                    <Td>{o.customer?.name || "—"}</Td>
                    <Td>
                      <span dir="ltr" className="inline-block">
                        {o.customer?.phone ? (
                          <a href={`tel:${o.customer.phone}`} className="text-primary hover:underline">
                            {o.customer.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                      </span>
                    </Td>
                    <Td>{o.customer?.city || "—"}</Td>
                    <Td className="font-semibold">{formatMoney(o.total, settings)}</Td>
                    <Td>
                      <StatusBadge status={o.status} />
                    </Td>
                    <Td className="no-print">
                      <div className="flex items-center gap-2">
                        <Link href={`/admin/orders/${o.id}`} className="btn btn-outline px-3 py-1.5 text-xs">
                          <Eye className="h-4 w-4" /> عرض
                        </Link>
                        <button
                          type="button"
                          onClick={() => whatsapp(o)}
                          title="فتح واتساب — الإرسال يدوي داخل التطبيق"
                          className="btn border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-100"
                        >
                          <MessageCircle className="h-4 w-4" /> واتساب
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-muted">الإرسال يدوي داخل واتساب</p>
                    </Td>
                  </tr>
                ))
              )}
            </tbody>
          </TableWrap>

          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </div>
      )}
    </div>
  );
}
