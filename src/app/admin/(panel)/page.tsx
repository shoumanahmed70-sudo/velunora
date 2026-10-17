"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  DollarSign,
  Package,
  Plus,
  Settings,
  ShoppingBag,
  Truck,
  Users,
} from "lucide-react";
import { ApiError, errorMessage, useApi } from "@/lib/api-client";
import { useStore } from "@/lib/store-provider";
import { useToast } from "@/lib/toast";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/lib/types";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import {
  AdminHeading,
  EmptyRow,
  ErrorBlock,
  LoadingBlock,
  Panel,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/admin/ui";

interface StatsResponse {
  totals: { orders: number; customers: number; products: number; revenue: number };
  statusCounts: Record<OrderStatus, number>;
  recentOrders: Order[];
}

function arabicDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return new Date(ts).toLocaleString();
  }
}

export default function AdminDashboardPage() {
  const api = useApi();
  const router = useRouter();
  const toast = useToast();
  const { settings } = useStore();

  const [data, setData] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.search.includes("denied=1")) {
      setDenied(true);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<StatsResponse>("/api/admin/stats");
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل الإحصائيات"));
    } finally {
      setLoading(false);
    }
  }, [api, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = [
    {
      key: "orders",
      label: "الطلبات",
      value: data ? String(data.totals.orders) : "—",
      icon: ShoppingBag,
      tint: "bg-purple-50 text-purple-700",
    },
    {
      key: "customers",
      label: "العملاء",
      value: data ? String(data.totals.customers) : "—",
      icon: Users,
      tint: "bg-blue-50 text-blue-700",
    },
    {
      key: "products",
      label: "المنتجات",
      value: data ? String(data.totals.products) : "—",
      icon: Package,
      tint: "bg-emerald-50 text-emerald-700",
    },
    {
      key: "revenue",
      label: "الإيرادات",
      value: data ? formatMoney(data.totals.revenue, settings) : "—",
      icon: DollarSign,
      tint: "bg-amber-50 text-amber-700",
    },
  ];

  return (
    <div>
      <AdminHeading
        title="لوحة المعلومات"
        description="نظرة سريعة على أداء المتجر وآخر الطلبات."
        actions={
          <>
            <Link href="/admin/products/new" className="btn btn-primary min-h-11 px-5 py-2.5 text-sm">
              <Plus className="h-4 w-4" /> منتج جديد
            </Link>
            <Link
              href="/admin/orders?status=new"
              className="btn btn-outline min-h-11 px-5 py-2.5 text-sm"
            >
              <Truck className="h-4 w-4" /> الطلبات الجديدة
            </Link>
            <Link href="/admin/settings" className="btn btn-ghost min-h-11 border border-line px-5 py-2.5 text-sm">
              <Settings className="h-4 w-4" /> الإعدادات
            </Link>
          </>
        }
      />

      {denied ? (
        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          ليست لديك صلاحية الوصول إلى تلك الصفحة.
        </p>
      ) : null}

      {loading ? (
        <LoadingBlock label="جارٍ تحميل الإحصائيات…" />
      ) : error ? (
        <ErrorBlock message={error} onRetry={() => void load()} />
      ) : data ? (
        <div className="space-y-6">
          {/* بطاقات الإحصاء */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.key} className="rounded-2xl border border-line bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-muted">{c.label}</span>
                    <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.tint}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-extrabold text-ink">{c.value}</p>
                </div>
              );
            })}
          </div>

          {/* شبكة حالات الطلبات */}
          <Panel title="الطلبات حسب الحالة">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {ORDER_STATUSES.map((status) => (
                <Link
                  key={status}
                  href={`/admin/orders?status=${status}`}
                  className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all duration-300 ease-luxe hover:-translate-y-0.5 ${STATUS_STYLES[status]}`}
                >
                  <span className="text-sm font-bold">{STATUS_LABELS[status]}</span>
                  <span className="text-lg font-extrabold">{data.statusCounts?.[status] ?? 0}</span>
                </Link>
              ))}
            </div>
          </Panel>

          {/* أحدث الطلبات */}
          <Panel
            title="أحدث الطلبات"
            actions={
              <Link href="/admin/orders" className="btn btn-outline px-4 py-1.5 text-xs">
                كل الطلبات <ArrowLeft className="h-4 w-4" />
              </Link>
            }
          >
            <TableWrap>
              <thead>
                <tr>
                  <Th>رقم الطلب</Th>
                  <Th>العميل</Th>
                  <Th>الجوال</Th>
                  <Th>الإجمالي</Th>
                  <Th>الحالة</Th>
                  <Th>التاريخ</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.length === 0 ? (
                  <EmptyRow colSpan={7} message="لا توجد طلبات بعد" />
                ) : (
                  data.recentOrders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <Td className="font-bold">{o.number}</Td>
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
                      <Td className="font-semibold">{formatMoney(o.total, settings)}</Td>
                      <Td>
                        <StatusBadge status={o.status} />
                      </Td>
                      <Td className="text-xs text-muted">{arabicDate(o.createdAt)}</Td>
                      <Td>
                        <Link
                          href={`/admin/orders/${o.id}`}
                          className="btn btn-outline px-3 py-1 text-xs"
                        >
                          التفاصيل
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
