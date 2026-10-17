"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2, Upload, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api-client";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import type { OrderStatus } from "@/lib/types";

/* ============================ عناصر التنسيق ============================ */

export const inputCls =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-gold focus:ring-4 focus:ring-gold/15 disabled:bg-cream/60";

export function AdminHeading({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-white p-5 shadow-sm ${className}`}>
      {title || actions ? (
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-base font-bold text-ink">{title}</h2> : null}
            {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
          </div>
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm font-semibold text-ink"
      aria-pressed={checked}
    >
      <span
        className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-emerald-600" : "bg-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? "start-5.5" : "start-0.5"
          }`}
          style={{ insetInlineStart: checked ? "1.4rem" : "0.15rem" }}
        />
      </span>
      {label}
    </button>
  );
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`chip border ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
  );
}

/* ============================ نوافذ ============================ */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm">
      <div
        className={`mt-10 w-full ${wide ? "max-w-4xl" : "max-w-xl"} rounded-2xl border border-line bg-white shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 hover:bg-cream" aria-label="إغلاق">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? <footer className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</footer> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "تأكيد",
  onConfirm,
  onClose,
  busy,
  danger,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            إلغاء
          </button>
          <button
            type="button"
            className={`btn ${danger ? "bg-red-600 text-white hover:bg-red-700" : "btn-primary"}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm leading-6 text-ink">{message}</p>
      </div>
    </Modal>
  );
}

/* ============================ جداول ============================ */

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full min-w-[640px] text-start text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`whitespace-nowrap border-b border-line bg-cream/50 px-4 py-3 text-start text-xs font-bold text-muted ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return <td className={`border-b border-line/70 px-4 py-3 align-middle text-ink ${className}`}>{children}</td>;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted">
        عرض {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} من {total}
      </span>
      <div className="flex items-center gap-2">
        <button type="button" className="btn btn-outline px-4 py-1.5" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          السابق
        </button>
        <span className="rounded-full bg-cream px-3 py-1 font-semibold">
          {page} / {pages}
        </span>
        <button type="button" className="btn btn-outline px-4 py-1.5" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          التالي
        </button>
      </div>
    </div>
  );
}

export function EmptyRow({ colSpan, message = "لا توجد بيانات" }: { colSpan: number; message?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">
        {message}
      </td>
    </tr>
  );
}

export function LoadingBlock({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-2xl border border-line bg-white py-14 text-sm text-muted">
      <Loader2 className="h-5 w-5 animate-spin text-gold" />
      {label}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-outline mt-3 border-red-300 text-red-700" onClick={onRetry}>
          إعادة المحاولة
        </button>
      ) : null}
    </div>
  );
}

/* ============================ رفع الصور ============================ */

export function ImageUploader({
  value,
  onChange,
  kind = "product",
  multiple = true,
  label = "الصور",
  hint = "JPG أو PNG أو WebP، بحد أقصى 8 ميجابايت للصورة. تُحوَّل الصور تلقائيًا إلى WebP.",
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  kind?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      const list = multiple ? Array.from(files) : Array.from(files).slice(0, 1);
      for (const file of list) form.append("files", file);
      form.append("kind", kind);
      const res = await api.upload<{ urls: string[] }>("/api/admin/upload", form);
      onChange(multiple ? [...value, ...res.urls] : res.urls);
    } catch (err) {
      setError(errorMessage(err, "تعذّر رفع الصورة"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeAt(index: number) {
    const url = value[index];
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    try {
      await api.del(`/api/admin/upload?url=${encodeURIComponent(url)}`);
    } catch {
      /* الصورة أُزيلت من الواجهة؛ فشل حذف الملف لا يعطّل العمل */
    }
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">{label}</span>
        <button
          type="button"
          className="btn btn-outline px-4 py-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "جارٍ الرفع…" : "رفع صورة"}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {value.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-8 text-center text-xs text-muted">
          لا توجد صور بعد — ارفع صورة واحدة على الأقل
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="group relative overflow-hidden rounded-xl border border-line bg-cream/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`صورة ${index + 1}`} className="h-28 w-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-ink/70 px-2 py-1 text-[11px] text-white opacity-0 transition group-hover:opacity-100">
                <div className="flex gap-1">
                  <button type="button" onClick={() => move(index, -1)} className="rounded px-1 hover:bg-white/20">
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)} className="rounded px-1 hover:bg-white/20">
                    ↓
                  </button>
                </div>
                <button type="button" onClick={() => void removeAt(index)} className="rounded px-1 hover:bg-white/20">
                  حذف
                </button>
              </div>
              {index === 0 && multiple ? (
                <span className="absolute top-1 start-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold text-white">
                  الرئيسية
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
      <p className="mt-2 text-xs text-muted">{hint}</p>
      {error ? <p className="mt-1 text-xs font-semibold text-red-700">{error}</p> : null}
    </div>
  );
}

export function SavedFlash({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
      <Check className="h-4 w-4" /> تم الحفظ
    </span>
  );
}
