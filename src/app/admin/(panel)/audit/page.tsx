"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { AuditEntry } from "@/lib/types";

const PAGE_SIZE = 25;
const MAX_FETCH = 200;

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

function includesNormalized(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.trim().toLowerCase());
}

export default function AuditPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [actor, setActor] = useState("");
  const [action, setAction] = useState("");
  const [target, setTarget] = useState("");
  const [page, setPage] = useState(1);

  const perms = me?.admin?.permissions ?? [];
  const allowed = me?.admin?.role === "owner" || perms.includes("audit");

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
      const res = await api.get<{ items: AuditEntry[] }>("/api/admin/audit");
      setItems(res.items);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل سجل التدقيق"));
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [actor, action, target]);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (actor && !includesNormalized(e.actorEmail, actor)) return false;
      if (action && !includesNormalized(e.action, action)) return false;
      if (target && !includesNormalized(e.target, target)) return false;
      return true;
    });
  }, [items, actor, action, target]);

  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <AdminHeading title="سجل التدقيق" description="تتبع الإجراءات الحسّاسة التي نفّذها المدراء" />

      <Panel
        title="أحدث السجلات"
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              type="search"
              className={`${inputCls} sm:w-44`}
              placeholder="المنفّذ (البريد)"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              aria-label="تصفية حسب المنفّذ"
            />
            <input
              type="search"
              className={`${inputCls} sm:w-44`}
              placeholder="الإجراء"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              aria-label="تصفية حسب الإجراء"
            />
            <input
              type="search"
              className={`${inputCls} sm:w-44`}
              placeholder="الهدف"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              aria-label="تصفية حسب الهدف"
            />
          </div>
        }
      >
        {items.length >= MAX_FETCH ? (
          <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
            يتم عرض أحدث {MAX_FETCH} سجل فقط.
          </p>
        ) : null}

        {loading && items.length === 0 ? (
          <LoadingBlock label="جارٍ تحميل السجل…" />
        ) : error ? (
          <ErrorBlock message={error} onRetry={() => void load()} />
        ) : (
          <>
            <TableWrap>
              <thead>
                <tr>
                  <Th>التاريخ والوقت</Th>
                  <Th>المنفّذ</Th>
                  <Th>الإجراء</Th>
                  <Th>الهدف</Th>
                  <Th>التفاصيل</Th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <EmptyRow
                    colSpan={5}
                    message={filtered.length === 0 && items.length > 0 ? "لا نتائج مطابقة للفلاتر" : "لا توجد سجلات"}
                  />
                ) : (
                  shown.map((e) => (
                    <tr key={e.id} className="transition hover:bg-cream/40">
                      <Td className="whitespace-nowrap">{formatDateTime(e.createdAt)}</Td>
                      <Td>
                        <span dir="ltr">{e.actorEmail || "—"}</span>
                      </Td>
                      <Td className="font-semibold">
                        <span dir="ltr">{e.action || "—"}</span>
                      </Td>
                      <Td>
                        <span dir="ltr" className="text-muted">
                          {e.target || "—"}
                        </span>
                      </Td>
                      <Td className="max-w-md whitespace-pre-wrap break-words text-xs text-muted">
                        {e.meta || "—"}
                      </Td>
                    </tr>
                  ))
                )}
              </tbody>
            </TableWrap>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={filtered.length}
              onPage={setPage}
            />
          </>
        )}
      </Panel>
    </>
  );
}
