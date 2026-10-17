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
import type {
  PrivateSettings,
  StoreColors,
  StoreSettings,
} from "@/lib/types";

type TabId = "identity" | "commerce" | "contact" | "private";

const FONTS = ["Cairo", "Tajawal", "Almarai", "Amiri", "Cormorant Garamond"];

const COLOR_FIELDS: Array<{ key: keyof StoreColors; label: string }> = [
  { key: "primary", label: "اللون الأساسي" },
  { key: "primarySoft", label: "الأساسي الفاتح" },
  { key: "gold", label: "الذهبي" },
  { key: "cream", label: "الكريمي" },
  { key: "background", label: "الخلفية" },
  { key: "text", label: "النص" },
];

function toNum(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <span className="mb-1.5 block text-sm font-semibold text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-line bg-white p-1"
          aria-label={`اختيار ${label}`}
        />
        <input
          className={inputCls}
          dir="ltr"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { me, loading: meLoading } = useMe();

  const [tab, setTab] = useState<TabId>("identity");
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [priv, setPriv] = useState<PrivateSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const isOwner = me?.admin?.role === "owner";
  const perms = me?.admin?.permissions ?? [];
  const allowed = isOwner || perms.includes("settings");

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
      const res = await api.get<{ settings: StoreSettings }>("/api/admin/settings");
      setSettings(res.settings);
      if (isOwner) {
        try {
          const p = await api.get<{ private: PrivateSettings }>("/api/admin/settings/private");
          setPriv(p.private);
        } catch {
          setPriv(null);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      setError(errorMessage(err, "تعذّر تحميل الإعدادات"));
    } finally {
      setLoading(false);
    }
  }, [isOwner, router, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isOwner && tab === "private") setTab("identity");
  }, [isOwner, tab]);

  function flash(key: string) {
    setSaved(key);
    setTimeout(() => setSaved((s) => (s === key ? null : s)), 2500);
  }

  function patch(p: Partial<StoreSettings>) {
    setSettings((s) => (s ? { ...s, ...p } : s));
  }
  function patchColors(p: Partial<StoreColors>) {
    setSettings((s) => (s ? { ...s, colors: { ...s.colors, ...p } } : s));
  }
  function patchContact(p: Partial<StoreSettings["contact"]>) {
    setSettings((s) => (s ? { ...s, contact: { ...s.contact, ...p } } : s));
  }
  function patchSocial(p: Partial<StoreSettings["social"]>) {
    setSettings((s) => (s ? { ...s, social: { ...s.social, ...p } } : s));
  }

  async function saveSettings(key: string) {
    if (!settings) return;
    setSaving(key);
    try {
      const res = await api.put<{ settings: StoreSettings }>("/api/admin/settings", settings);
      setSettings(res.settings);
      toast("تم حفظ الإعدادات", "success");
      flash(key);
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ الإعدادات"), "error");
    } finally {
      setSaving(null);
    }
  }

  async function savePrivate() {
    if (!priv) return;
    const num = priv.whatsappNumber.trim();
    if (num && !/^\d{8,15}$/.test(num)) {
      toast("رقم واتساب يجب أن يكون أرقامًا فقط مع رمز الدولة بدون + (مثال 9665xxxxxxxx)", "error");
      return;
    }
    setSaving("private");
    try {
      const res = await api.put<{ private: PrivateSettings }>("/api/admin/settings/private", priv);
      setPriv(res.private);
      toast("تم حفظ إعدادات واتساب والبريد", "success");
      flash("private");
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        toast(errorMessage(err), "error");
        router.push("/admin/login");
        return;
      }
      toast(errorMessage(err, "تعذّر حفظ الإعدادات الخاصة"), "error");
    } finally {
      setSaving(null);
    }
  }

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "identity", label: "الهوية" },
    { id: "commerce", label: "التجارة" },
    { id: "contact", label: "التواصل" },
    ...(isOwner ? [{ id: "private" as TabId, label: "واتساب والبريد" }] : []),
  ];

  const busy = saving !== null;

  if (meLoading || (loading && !settings)) {
    return <LoadingBlock label="جارٍ تحميل الإعدادات…" />;
  }

  if (error || !settings) {
    return <ErrorBlock message={error ?? "تعذّر تحميل الإعدادات"} onRetry={() => void load()} />;
  }

  return (
    <>
      <AdminHeading title="الإعدادات" description="إعدادات المتجر العامة والهوية والتواصل" />

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`btn px-5 py-2 text-sm ${
              tab === t.id ? "btn-primary" : "btn-outline"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "identity" ? (
        <div className="space-y-6">
          <Panel title="هوية المتجر" description="الاسم والشعار والوصف الظاهر للزوار">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="اسم المتجر (عربي)">
                <input
                  className={inputCls}
                  value={settings.storeName}
                  onChange={(e) => patch({ storeName: e.target.value })}
                />
              </Field>
              <Field label="اسم المتجر (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.storeNameEn}
                  onChange={(e) => patch({ storeNameEn: e.target.value })}
                />
              </Field>
              <Field label="الشعار النصي (عربي)">
                <input
                  className={inputCls}
                  value={settings.tagline}
                  onChange={(e) => patch({ tagline: e.target.value })}
                />
              </Field>
              <Field label="الشعار النصي (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.taglineEn}
                  onChange={(e) => patch({ taglineEn: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <ImageUploader
                kind="logo"
                multiple={false}
                label="شعار المتجر"
                hint="صورة واحدة (PNG أو SVG مفضّلة). تُحوَّل تلقائيًا إلى WebP."
                value={settings.logoUrl ? [settings.logoUrl] : []}
                onChange={(urls) => patch({ logoUrl: urls[0] ?? "" })}
              />
              <ImageUploader
                kind="favicon"
                multiple={false}
                label="أيقونة الموقع (Favicon)"
                hint="مربّعة صغيرة تظهر بجانب عنوان الصفحة في المتصفح."
                value={settings.faviconUrl ? [settings.faviconUrl] : []}
                onChange={(urls) => patch({ faviconUrl: urls[0] ?? "" })}
              />
            </div>
          </Panel>

          <Panel title="ألوان الهوية" description="تُطبّق الألوان على كامل المتجر ولوحة الإدارة">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {COLOR_FIELDS.map((c) => (
                <ColorField
                  key={c.key}
                  label={c.label}
                  value={settings.colors[c.key]}
                  onChange={(v) => patchColors({ [c.key]: v } as Partial<StoreColors>)}
                />
              ))}
            </div>

            <div className="mt-6">
              <p className="mb-2 text-sm font-semibold text-ink">معاينة حيّة</p>
              <div
                className="rounded-2xl border border-line p-5"
                style={{
                  background: settings.colors.background,
                  color: settings.colors.text,
                  fontFamily: settings.bodyFont || undefined,
                }}
              >
                <p className="text-xs font-semibold" style={{ color: settings.colors.gold }}>
                  معاينة الهوية
                </p>
                <p
                  className="mt-1 text-xl font-extrabold"
                  style={{ fontFamily: settings.headingFont || undefined }}
                >
                  {settings.storeName || "VELUNORA"}
                </p>
                <p className="mt-1 text-sm opacity-90">{settings.tagline || "شعار المتجر"}</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span
                    className="rounded-full px-5 py-2 text-sm font-semibold"
                    style={{ background: settings.colors.primary, color: "#ffffff" }}
                  >
                    {settings.storeNameEn || "Shop"}
                  </span>
                  <span
                    className="rounded-full px-5 py-2 text-sm font-semibold"
                    style={{ background: settings.colors.gold, color: "#2b1c0a" }}
                  >
                    ذهبي
                  </span>
                  <span
                    className="rounded-full border px-4 py-2 text-sm font-semibold"
                    style={{ borderColor: settings.colors.primarySoft, color: settings.colors.primarySoft }}
                  >
                    ثانوي
                  </span>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="الخطوط">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="خط العناوين">
                <select
                  className={inputCls}
                  value={settings.headingFont}
                  onChange={(e) => patch({ headingFont: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="خط النصوص">
                <select
                  className={inputCls}
                  value={settings.bodyFont}
                  onChange={(e) => patch({ bodyFont: e.target.value })}
                >
                  {FONTS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Panel>

          <Panel title="تحسين محرّكات البحث (SEO)">
            <div className="space-y-4">
              <Field label="عنوان SEO">
                <input
                  className={inputCls}
                  value={settings.seoTitle}
                  onChange={(e) => patch({ seoTitle: e.target.value })}
                />
              </Field>
              <Field label="وصف SEO">
                <textarea
                  className={`${inputCls} min-h-24`}
                  value={settings.seoDescription}
                  onChange={(e) => patch({ seoDescription: e.target.value })}
                />
              </Field>
              <Field label="كلمات مفتاحية" hint="افصل بين الكلمات بفاصلة (,)">
                <input
                  className={inputCls}
                  value={settings.seoKeywords}
                  onChange={(e) => patch({ seoKeywords: e.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveSettings("identity")}
              disabled={busy}
            >
              {saving === "identity" ? "جارٍ الحفظ…" : "حفظ الهوية"}
            </button>
            <SavedFlash show={saved === "identity"} />
          </div>
        </div>
      ) : null}

      {tab === "commerce" ? (
        <div className="space-y-6">
          <Panel title="العملة والضريبة والشحن">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="كود العملة" hint="مثال: SAR">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.currency}
                  onChange={(e) => patch({ currency: e.target.value })}
                />
              </Field>
              <Field label="رمز العملة" hint="مثال: ر.س">
                <input
                  className={inputCls}
                  value={settings.currencySymbol}
                  onChange={(e) => patch({ currencySymbol: e.target.value })}
                />
              </Field>
              <Field label="الحد الأدنى للطلب">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={settings.minOrder}
                  onChange={(e) => patch({ minOrder: toNum(e.target.value) })}
                />
              </Field>
              <Field label="نسبة الضريبة (%)">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={settings.taxRate}
                  onChange={(e) => patch({ taxRate: toNum(e.target.value) })}
                />
              </Field>
              <Field label="قيمة الشحن">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={settings.shippingFee}
                  onChange={(e) => patch({ shippingFee: toNum(e.target.value) })}
                />
              </Field>
              <Field label="الشحن المجاني عند" hint="اتركه فارغًا لتعطيل الشحن المجاني">
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={settings.freeShippingOver ?? ""}
                  onChange={(e) =>
                    patch({ freeShippingOver: e.target.value === "" ? null : toNum(e.target.value) })
                  }
                />
              </Field>
            </div>

            <div className="mt-5 flex flex-wrap gap-6">
              <Toggle
                checked={settings.taxEnabled}
                onChange={(v) => patch({ taxEnabled: v })}
                label="تفعيل الضريبة"
              />
              <Toggle
                checked={settings.reviewsEnabled}
                onChange={(v) => patch({ reviewsEnabled: v })}
                label="تفعيل تقييمات العملاء"
              />
            </div>
          </Panel>

          <Panel title="استقبال الطلبات">
            <Toggle
              checked={settings.ordersEnabled}
              onChange={(v) => patch({ ordersEnabled: v })}
              label="استقبال الطلبات مفعّل"
            />
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
              تحذير: عند إيقاف استقبال الطلبات يتعذّر على العملاء إنشاء طلبات جديدة، ويظهر تنبيه في المتجر.
            </p>
          </Panel>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveSettings("commerce")}
              disabled={busy}
            >
              {saving === "commerce" ? "جارٍ الحفظ…" : "حفظ إعدادات التجارة"}
            </button>
            <SavedFlash show={saved === "commerce"} />
          </div>
        </div>
      ) : null}

      {tab === "contact" ? (
        <div className="space-y-6">
          <Panel title="بيانات التواصل">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="رقم الهاتف">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.contact.phone}
                  onChange={(e) => patchContact({ phone: e.target.value })}
                />
              </Field>
              <Field label="البريد الإلكتروني">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.contact.email}
                  onChange={(e) => patchContact({ email: e.target.value })}
                />
              </Field>
              <Field label="العنوان (عربي)">
                <input
                  className={inputCls}
                  value={settings.contact.address}
                  onChange={(e) => patchContact({ address: e.target.value })}
                />
              </Field>
              <Field label="العنوان (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.contact.addressEn}
                  onChange={(e) => patchContact({ addressEn: e.target.value })}
                />
              </Field>
              <Field label="ساعات العمل" className="sm:col-span-2">
                <input
                  className={inputCls}
                  value={settings.contact.workingHours}
                  onChange={(e) => patchContact({ workingHours: e.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="روابط التواصل الاجتماعي" description="اترك الحقل فارغًا لإخفاء الأيقونة في المتجر">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Instagram">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.social.instagram}
                  onChange={(e) => patchSocial({ instagram: e.target.value })}
                />
              </Field>
              <Field label="TikTok">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.social.tiktok}
                  onChange={(e) => patchSocial({ tiktok: e.target.value })}
                />
              </Field>
              <Field label="Snapchat">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.social.snapchat}
                  onChange={(e) => patchSocial({ snapchat: e.target.value })}
                />
              </Field>
              <Field label="Facebook">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.social.facebook}
                  onChange={(e) => patchSocial({ facebook: e.target.value })}
                />
              </Field>
              <Field label="X">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.social.x}
                  onChange={(e) => patchSocial({ x: e.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <Panel title="شريط الإعلانات" description="اتركه فارغًا لإخفاء الشريط أعلى المتجر">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="نص الإعلان (عربي)">
                <input
                  className={inputCls}
                  value={settings.announcement}
                  onChange={(e) => patch({ announcement: e.target.value })}
                />
              </Field>
              <Field label="نص الإعلان (إنجليزي)">
                <input
                  className={inputCls}
                  dir="ltr"
                  value={settings.announcementEn}
                  onChange={(e) => patch({ announcementEn: e.target.value })}
                />
              </Field>
            </div>
          </Panel>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveSettings("contact")}
              disabled={busy}
            >
              {saving === "contact" ? "جارٍ الحفظ…" : "حفظ بيانات التواصل"}
            </button>
            <SavedFlash show={saved === "contact"} />
          </div>
        </div>
      ) : null}

      {tab === "private" && isOwner ? (
        <div className="space-y-6">
          {priv ? (
            <>
              <Panel title="رقم واتساب للطلبات" description="خاص ولا يظهر في واجهة المتجر مطلقًا">
                <Field
                  label="رقم واتساب"
                  hint="أرقام فقط مع رمز الدولة بدون + مثال: 9665xxxxxxxx"
                  required
                >
                  <input
                    className={inputCls}
                    dir="ltr"
                    inputMode="numeric"
                    value={priv.whatsappNumber}
                    onChange={(e) =>
                      setPriv((p) => (p ? { ...p, whatsappNumber: e.target.value } : p))
                    }
                    placeholder="9665xxxxxxxx"
                  />
                </Field>
                <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs leading-6 text-red-800">
                  تنبيه: هذا هو الرقم الذي تُرسَل إليه طلبات العملاء عبر واتساب. لا يظهر هذا الرقم في واجهة
                  المتجر أبدًا؛ تُبنى روابط واتساب على الخادم دون كشف الرقم للزائر.
                </p>
              </Panel>

              <Panel title="إعدادات البريد (SMTP)" description="لإرسال رسائل التأكيد والاستعادة">
                <Toggle
                  checked={priv.smtp.enabled}
                  onChange={(v) => setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, enabled: v } } : p))}
                  label="تفعيل إرسال البريد"
                />
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="المضيف (Host)">
                    <input
                      className={inputCls}
                      dir="ltr"
                      value={priv.smtp.host}
                      onChange={(e) =>
                        setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, host: e.target.value } } : p))
                      }
                      placeholder="smtp.example.com"
                    />
                  </Field>
                  <Field label="المنفذ (Port)">
                    <input
                      type="number"
                      className={inputCls}
                      dir="ltr"
                      value={priv.smtp.port}
                      onChange={(e) =>
                        setPriv((p) =>
                          p ? { ...p, smtp: { ...p.smtp, port: toNum(e.target.value) } } : p
                        )
                      }
                    />
                  </Field>
                  <Field label="المستخدم">
                    <input
                      className={inputCls}
                      dir="ltr"
                      value={priv.smtp.user}
                      onChange={(e) =>
                        setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, user: e.target.value } } : p))
                      }
                    />
                  </Field>
                  <Field label="كلمة المرور" hint="تُخزَّن في قاعدة البيانات ولا تظهر لأي عميل">
                    <input
                      type="password"
                      className={inputCls}
                      dir="ltr"
                      value={priv.smtp.pass}
                      onChange={(e) =>
                        setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, pass: e.target.value } } : p))
                      }
                    />
                  </Field>
                  <Field label="البريد المُرسِل (From)">
                    <input
                      className={inputCls}
                      dir="ltr"
                      value={priv.smtp.from}
                      onChange={(e) =>
                        setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, from: e.target.value } } : p))
                      }
                      placeholder="VELUNORA <no-reply@example.com>"
                    />
                  </Field>
                </div>
                <div className="mt-4">
                  <Toggle
                    checked={priv.smtp.secure}
                    onChange={(v) => setPriv((p) => (p ? { ...p, smtp: { ...p.smtp, secure: v } } : p))}
                    label="اتصال آمن (SSL/TLS)"
                  />
                </div>
                <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
                  تنبيه: رسائل البريد لا تعمل إلا بعد ضبط الإعدادات أعلاه بشكل صحيح ثم تفعيلها.
                </p>
              </Panel>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void savePrivate()}
                  disabled={busy}
                >
                  {saving === "private" ? "جارٍ الحفظ…" : "حفظ الإعدادات الخاصة"}
                </button>
                <SavedFlash show={saved === "private"} />
              </div>
            </>
          ) : (
            <ErrorBlock
              message="تعذّر تحميل الإعدادات الخاصة"
              onRetry={() => void load()}
            />
          )}
        </div>
      ) : null}
    </>
  );
}
