"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, api, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { useToast } from "@/lib/toast";
import {
  AdminHeading,
  ErrorBlock,
  Field,
  LoadingBlock,
  Panel,
  SavedFlash,
  inputCls,
} from "@/components/admin/ui";
import type { PageDoc } from "@/lib/types";

interface PageForm {
  title: string;
  titleEn: string;
  content: string;
  contentEn: string;
}

function toForm(p: PageDoc): PageForm {
  return {
    title: p.title ?? "",
    titleEn: p.titleEn ?? "",
    content: p.content ?? "",
    contentEn: p.contentEn ?? "",
  };
}

export default function ContentPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [items, setItems] = useState<PageDoc[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [form, setForm] = useState<PageForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const perms = me?.admin?.permissions ?? [];
  const allowed = me?.admin?.role === "owner" || perms.includes("pages");

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
      const res = await api.get<{ items: PageDoc[] }>("/api/admin/pages");
      setItems(res.items);
      if (res.items.length > 0) {
        setSlug((current) => current ?? res.items[0].slug);
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل الصفحات"));
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!slug) {
      setForm(null);
      return;
    }
    const page = items.find((p) => p.slug === slug);
    setForm(page ? toForm(page) : null);
  }, [slug, items]);

  async function save() {
    if (!slug || !form) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.put<{ page: PageDoc }>(`/api/admin/pages/${encodeURIComponent(slug)}`, {
        slug,
        title: form.title,
        titleEn: form.titleEn,
        content: form.content,
        contentEn: form.contentEn,
      });
      setItems((prev) => prev.map((p) => (p.slug === slug ? res.page : p)));
      setForm(toForm(res.page));
      toast("تم حفظ الصفحة", "success");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ الصفحة"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || (loading && items.length === 0)) {
    return <LoadingBlock label="جارٍ تحميل الصفحات…" />;
  }

  if (error) {
    return <ErrorBlock message={error} onRetry={() => void load()} />;
  }

  const current = items.find((p) => p.slug === slug) ?? null;

  return (
    <>
      <AdminHeading
        title="المحتوى والسياسات"
        description="حرّر نصوص الصفحات التعريفية والسياسات"
      />

      <p className="mb-5 rounded-xl border border-line bg-cream/40 px-4 py-3 text-xs leading-6 text-muted">
        تظهر هذه النصوص في صفحات المتجر ضمن المسار <span dir="ltr">/p/&lt;slug&gt;</span> وفي تذييل
        الموقع.
      </p>

      {items.length === 0 ? (
        <ErrorBlock message="لا توجد صفحات" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <Panel title="الصفحات">
            <div className="flex flex-col gap-1.5">
              {items.map((p) => (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setSlug(p.slug)}
                  className={`rounded-xl border px-4 py-3 text-start text-sm font-semibold transition ${
                    p.slug === slug
                      ? "border-gold bg-cream text-ink"
                      : "border-line text-muted hover:bg-cream/50 hover:text-ink"
                  }`}
                >
                  <span className="block">{p.title || p.slug}</span>
                  <span dir="ltr" className="mt-0.5 block text-[11px] font-normal text-muted">
                    /p/{p.slug}
                  </span>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title={current ? current.title || current.slug : "المحرّر"}
            description={slug ? `المسار: /p/${slug}` : undefined}
          >
            {form ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="العنوان (عربي)">
                    <input
                      className={inputCls}
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                    />
                  </Field>
                  <Field label="العنوان (إنجليزي)">
                    <input
                      className={inputCls}
                      dir="ltr"
                      value={form.titleEn}
                      onChange={(e) => setForm({ ...form, titleEn: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="المحتوى (عربي)">
                  <textarea
                    className={`${inputCls} min-h-56 leading-7`}
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                  />
                </Field>
                <Field label="المحتوى (إنجليزي)">
                  <textarea
                    className={`${inputCls} min-h-56 leading-7`}
                    dir="ltr"
                    value={form.contentEn}
                    onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
                  />
                </Field>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void save()}
                    disabled={saving}
                  >
                    {saving ? "جارٍ الحفظ…" : "حفظ الصفحة"}
                  </button>
                  <SavedFlash show={saved} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">اختر صفحة من القائمة لتحريرها.</p>
            )}
          </Panel>
        </div>
      )}
    </>
  );
}
