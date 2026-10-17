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
  ImageUploader,
  LoadingBlock,
  Panel,
  SavedFlash,
  Toggle,
  inputCls,
} from "@/components/admin/ui";
import type { Banner, HomeSection, HomeSectionType, HomeSettings } from "@/lib/types";

const SECTION_TYPES: Array<{ value: HomeSectionType; label: string }> = [
  { value: "categories", label: "الأقسام" },
  { value: "featured", label: "منتجات مميزة" },
  { value: "new", label: "وصل حديثًا" },
  { value: "sale", label: "عروض وخصومات" },
  { value: "bestsellers", label: "الأكثر مبيعًا" },
  { value: "banner", label: "بانر مخصص" },
];

function newId(prefix: string): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}-${crypto.randomUUID()}`;
    }
  } catch {
    /* تجاهل */
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function HomepagePage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [home, setHome] = useState<HomeSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const perms = me?.admin?.permissions ?? [];
  const allowed = me?.admin?.role === "owner" || perms.includes("home");

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
      const res = await api.get<{ home: HomeSettings }>("/api/admin/home");
      setHome(res.home);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل إعدادات الصفحة الرئيسية"));
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  function patchHero(p: Partial<HomeSettings>) {
    setHome((h) => (h ? { ...h, ...p } : h));
  }

  function patchBanner(index: number, p: Partial<Banner>) {
    setHome((h) =>
      h ? { ...h, banners: h.banners.map((b, i) => (i === index ? { ...b, ...p } : b)) } : h
    );
  }
  function addBanner() {
    const banner: Banner = {
      id: newId("bnr"),
      image: "",
      title: "",
      titleEn: "",
      subtitle: "",
      subtitleEn: "",
      buttonText: "",
      buttonTextEn: "",
      buttonHref: "",
      active: true,
    };
    setHome((h) => (h ? { ...h, banners: [...h.banners, banner] } : h));
  }
  function removeBanner(index: number) {
    setHome((h) => (h ? { ...h, banners: h.banners.filter((_, i) => i !== index) } : h));
  }
  function moveBanner(index: number, dir: -1 | 1) {
    setHome((h) => {
      if (!h) return h;
      const target = index + dir;
      if (target < 0 || target >= h.banners.length) return h;
      const next = [...h.banners];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...h, banners: next };
    });
  }

  function patchSection(index: number, p: Partial<HomeSection>) {
    setHome((h) =>
      h ? { ...h, sections: h.sections.map((s, i) => (i === index ? { ...s, ...p } : s)) } : h
    );
  }
  function moveSection(index: number, dir: -1 | 1) {
    setHome((h) => {
      if (!h) return h;
      const target = index + dir;
      if (target < 0 || target >= h.sections.length) return h;
      const next = [...h.sections];
      [next[index], next[target]] = [next[target], next[index]];
      return { ...h, sections: next.map((s, i) => ({ ...s, order: i + 1 })) };
    });
  }

  async function save() {
    if (!home) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await api.put<{ home: HomeSettings }>("/api/admin/home", home);
      setHome(res.home);
      toast("تم حفظ إعدادات الصفحة الرئيسية", "success");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ إعدادات الصفحة الرئيسية"), "error");
    } finally {
      setSaving(false);
    }
  }

  if (meLoading || (loading && !home)) {
    return <LoadingBlock label="جارٍ تحميل إعدادات الصفحة الرئيسية…" />;
  }

  if (error || !home) {
    return (
      <ErrorBlock
        message={error ?? "تعذّر تحميل إعدادات الصفحة الرئيسية"}
        onRetry={() => void load()}
      />
    );
  }

  return (
    <>
      <AdminHeading
        title="الصفحة الرئيسية"
        description="البانر الرئيسي والبانرات الإضافية وأقسام الصفحة الرئيسية"
      />

      <div className="space-y-6">
        <Panel title="البانر الرئيسي (Hero)" description="أول ما يراه الزائر عند فتح المتجر">
          <div className="space-y-4">
            <ImageUploader
              kind="home"
              multiple={false}
              label="صورة البانر الرئيسي"
              value={home.heroImage ? [home.heroImage] : []}
              onChange={(urls) => patchHero({ heroImage: urls[0] ?? "" })}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="العنوان (عربي)">
                <input
                  className={inputCls}
                  value={home.heroTitle}
                  onChange={(e) => patchHero({ heroTitle: e.target.value })}
                />
              </Field>
              <Field label="العنوان (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={home.heroTitleEn}
                  onChange={(e) => patchHero({ heroTitleEn: e.target.value })}
                />
              </Field>
              <Field label="العنوان الفرعي (عربي)">
                <textarea
                  className={`${inputCls} min-h-20`}
                  value={home.heroSubtitle}
                  onChange={(e) => patchHero({ heroSubtitle: e.target.value })}
                />
              </Field>
              <Field label="العنوان الفرعي (إنجليزي)">
                <textarea
                  className={`${inputCls} min-h-20`}
                  dir="ltr"
                  value={home.heroSubtitleEn}
                  onChange={(e) => patchHero({ heroSubtitleEn: e.target.value })}
                />
              </Field>
              <Field label="نص الزر (عربي)">
                <input
                  className={inputCls}
                  value={home.heroButtonText}
                  onChange={(e) => patchHero({ heroButtonText: e.target.value })}
                />
              </Field>
              <Field label="نص الزر (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={home.heroButtonTextEn}
                  onChange={(e) => patchHero({ heroButtonTextEn: e.target.value })}
                />
              </Field>
              <Field label="رابط الزر" hint="مثال: /products" className="sm:col-span-2">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={home.heroButtonHref}
                  onChange={(e) => patchHero({ heroButtonHref: e.target.value })}
                />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel
          title="البانرات الإضافية"
          description="بانرات ترويجية أسفل البانر الرئيسي"
          actions={
            <button type="button" className="btn btn-outline px-4 py-2 text-sm" onClick={addBanner}>
              إضافة بانر
            </button>
          }
        >
          {home.banners.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-10 text-center text-sm text-muted">
              لا توجد بانرات إضافية بعد — أضف بانرًا جديدًا.
            </div>
          ) : (
            <div className="space-y-4">
              {home.banners.map((b, index) => (
                <div key={b.id} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">بانر #{index + 1}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => moveBanner(index, -1)}
                        disabled={index === 0}
                        aria-label="تحريك لأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => moveBanner(index, 1)}
                        disabled={index === home.banners.length - 1}
                        aria-label="تحريك لأسفل"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn px-3 py-1.5 text-xs bg-red-600 text-white hover:bg-red-700"
                        onClick={() => removeBanner(index)}
                      >
                        حذف
                      </button>
                    </div>
                  </div>

                  <ImageUploader
                    kind="banner"
                    multiple={false}
                    label="صورة البانر"
                    value={b.image ? [b.image] : []}
                    onChange={(urls) => patchBanner(index, { image: urls[0] ?? "" })}
                  />

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Field label="العنوان (عربي)">
                      <input
                        className={inputCls}
                        value={b.title}
                        onChange={(e) => patchBanner(index, { title: e.target.value })}
                      />
                    </Field>
                    <Field label="العنوان (إنجليزي)">
                      <input
                        className={inputCls}
                        dir="ltr"
                        value={b.titleEn}
                        onChange={(e) => patchBanner(index, { titleEn: e.target.value })}
                      />
                    </Field>
                    <Field label="الوصف (عربي)">
                      <input
                        className={inputCls}
                        value={b.subtitle}
                        onChange={(e) => patchBanner(index, { subtitle: e.target.value })}
                      />
                    </Field>
                    <Field label="الوصف (إنجليزي)">
                      <input
                        className={inputCls}
                        dir="ltr"
                        value={b.subtitleEn}
                        onChange={(e) => patchBanner(index, { subtitleEn: e.target.value })}
                      />
                    </Field>
                    <Field label="نص الزر (عربي)">
                      <input
                        className={inputCls}
                        value={b.buttonText}
                        onChange={(e) => patchBanner(index, { buttonText: e.target.value })}
                      />
                    </Field>
                    <Field label="نص الزر (إنجليزي)">
                      <input
                        className={inputCls}
                        dir="ltr"
                        value={b.buttonTextEn}
                        onChange={(e) => patchBanner(index, { buttonTextEn: e.target.value })}
                      />
                    </Field>
                    <Field label="رابط الزر" className="sm:col-span-2">
                      <input
                        className={inputCls}
                        dir="ltr"
                        value={b.buttonHref}
                        onChange={(e) => patchBanner(index, { buttonHref: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="mt-3">
                    <Toggle
                      checked={b.active}
                      onChange={(v) => patchBanner(index, { active: v })}
                      label="مفعّل"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="أقسام الصفحة الرئيسية"
          description="تحكّم في ترتيب الأقسام وتفعيلها وعناوينها"
        >
          {home.sections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line bg-cream/40 px-4 py-10 text-center text-sm text-muted">
              لا توجد أقسام.
            </div>
          ) : (
            <div className="space-y-4">
              {home.sections.map((s, index) => (
                <div key={s.id} className="rounded-2xl border border-line p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-ink">
                      القسم #{index + 1} — {SECTION_TYPES.find((t) => t.value === s.type)?.label ?? s.type}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => moveSection(index, -1)}
                        disabled={index === 0}
                        aria-label="تحريك لأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost px-3 py-1.5 text-xs"
                        onClick={() => moveSection(index, 1)}
                        disabled={index === home.sections.length - 1}
                        aria-label="تحريك لأسفل"
                      >
                        ↓
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Field label="النوع">
                      <select
                        className={inputCls}
                        value={s.type}
                        onChange={(e) =>
                          patchSection(index, { type: e.target.value as HomeSectionType })
                        }
                      >
                        {SECTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="العنوان (عربي)">
                      <input
                        className={inputCls}
                        value={s.title}
                        onChange={(e) => patchSection(index, { title: e.target.value })}
                      />
                    </Field>
                    <Field label="العنوان (إنجليزي)">
                      <input
                        className={inputCls}
                        dir="ltr"
                        value={s.titleEn}
                        onChange={(e) => patchSection(index, { titleEn: e.target.value })}
                      />
                    </Field>
                    <Field label="عدد المنتجات المعروضة">
                      <input
                        type="number"
                        min={0}
                        className={inputCls}
                        value={s.limit}
                        onChange={(e) => {
                          const n = Number(e.target.value);
                          patchSection(index, { limit: Number.isFinite(n) ? n : 0 });
                        }}
                      />
                    </Field>
                  </div>

                  {s.type === "banner" ? (
                    <div className="mt-4">
                      <ImageUploader
                        kind="banner"
                        multiple={false}
                        label="صورة القسم"
                        value={s.image ? [s.image] : []}
                        onChange={(urls) => patchSection(index, { image: urls[0] ?? "" })}
                      />
                    </div>
                  ) : null}

                  <div className="mt-3">
                    <Toggle
                      checked={s.active}
                      onChange={(v) => patchSection(index, { active: v })}
                      label="مفعّل"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="flex items-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={saving}>
            {saving ? "جارٍ الحفظ…" : "حفظ التغييرات"}
          </button>
          <SavedFlash show={saved} />
        </div>
      </div>
    </>
  );
}
