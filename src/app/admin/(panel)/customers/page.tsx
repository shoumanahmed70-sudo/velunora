"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import {
  AdminHeading,
  EmptyRow,
  ErrorBlock,
  LoadingBlock,
  Pagination,
  Panel,
  TableWrap,
  Td,
  Th,
  inputCls,
} from "@/components/admin/ui";
import type { CustomerProfile } from "@/lib/types";

type CustomerRow = CustomerProfile & { orderCount: number };

interface ListResponse {
  items: CustomerRow[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 20;

function formatDate(ts: number): string {
  if (!ts) return "—";
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "medium" }).format(new Date(ts));
  } catch {
    return "—";
  }
}

export default function CustomersPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ListResponse>(
        `/api/admin/customers?q=${encodeURIComponent(debouncedQ)}&page=${page}&pageSize=${PAGE_SIZE}`
      );
      setData(res);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل العملاء"));
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = data?.items ?? [];

  return (
    <>
      <AdminHeading title="العملاء" description="إدارة حسابات العملاء المسجَّلين وطلباتهم" />

      <Panel
        title="قائمة العملاء"
        description="ابحث بالاسم أو البريد الإلكتروني أو رقم الجوال أو المدينة"
        actions={
          <input
            type="search"
            className={`${inputCls} sm:w-72`}
            placeholder="بحث…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="بحث في العملاء"
          />
        }
      >
        {loading && !data ? (
          <LoadingBlock label="جارٍ تحميل العملاء…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>الاسم</Th>
                  <Th>البريد الإلكتروني</Th>
                  <Th>الجوال</Th>
                  <Th>المدينة</Th>
                  <Th>عدد الطلبات</Th>
                  <Th>تاريخ التسجيل</Th>
                  <Th>الحالة</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <EmptyRow colSpan={8} message="لا يوجد عملاء مطابقون" />
                ) : (
                  rows.map((c) => (
                    <tr key={c.uid} className="transition hover:bg-cream/40">
                      <Td className="font-semibold">{c.name || "—"}</Td>
                      <Td>
                        <span dir="ltr">{c.email || "—"}</span>
                      </Td>
                      <Td>
                        {c.phone ? (
                          <a href={`tel:${c.phone}`} className="text-primary hover:underline">
                            <span dir="ltr">{c.phone}</span>
                          </a>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>{c.city || "—"}</Td>
                      <Td className="tabular-nums">{c.orderCount}</Td>
                      <Td>{formatDate(c.createdAt)}</Td>
                      <Td>
                        <span
                          className={`chip border ${
                            c.disabled
                              ? "bg-red-100 text-red-700 border-red-200"
                              : "bg-emerald-100 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          {c.disabled ? "معطّل" : "نشط"}
                        </span>
                      </Td>
                      <Td>
                        <Link
                          href={`/admin/customers/${c.uid}`}
                          className="btn btn-outline px-3 py-1.5 text-xs"
                        >
                          عرض
                        </Link>
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>

            {data ? (
              <Pagination
                page={data.page}
                pageSize={data.pageSize}
                total={data.total}
                onPage={setPage}
              />
            ) : null}
          </>
        )}
      </Panel>
    </>
  );
}
