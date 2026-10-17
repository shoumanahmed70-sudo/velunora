"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/money";
import type { Order, StoreSettings } from "@/lib/types";
import { statusLabelKey } from "@/components/shop/orderStatus";
import { L } from "@/components/shop/utils";

interface Props {
  order: Order;
  settings: StoreSettings | null;
  lang?: "ar" | "en";
}

/** نبرة الختم/الشارة حسب حالة الطلب. */
const TONE: Record<string, "info" | "warn" | "ok" | "bad"> = {
  new: "warn",
  pending: "warn",
  confirmed: "info",
  processing: "info",
  shipped: "info",
  completed: "ok",
  cancelled: "bad",
};

/** تاريخ ميلادي بصيغة واضحة (أرقام لاتينية) بدل التقويم الهجري الافتراضي. */
function formatDateTime(ts: number, lang: "ar" | "en"): string {
  try {
    const locale = lang === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB";
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

/** تغليف الرابط الاجتماعي إلى مُعرّف مقروء (‎@name‎). */
function handle(value: string): string {
  const clean = (value || "").trim().replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "");
  const last = clean.split("/").pop() || clean;
  return last.startsWith("@") ? last : `@${last}`;
}

/** صورة الصنف مع بديل أنيق إن فشل التحميل (لا صور مكسورة).
 *  بلا `loading="lazy"` حتى تكون الصور جاهزة لحظة الطباعة. */
function Thumb({ src, label }: { src: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  const show = Boolean(src) && !failed;
  return (
    <div className="inv-thumb">
      {show ? (
        <img src={src as string} alt="" decoding="async" onError={() => setFailed(true)} />
      ) : (
        <span aria-hidden>{(label || "V").trim().charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}

/**
 * مستند الفاتورة (بدون أزرار) — يُستخدم في واجهة العميل ولوحة الإدارة.
 * الغلاف `.invoice-print` يُستخدم لعزل الفاتورة عند الطباعة.
 * الشكل داكن فخم على الشاشة، ويتحوّل لنسخة ورقية فاتحة عند الطباعة (انظر globals.css).
 */
export function InvoiceDocument({ order, settings, lang = "ar" }: Props) {
  const t = useT();
  const storeName = settings?.storeName || "VELUNORA";
  const storeNameEn = settings?.storeNameEn || "";
  const logo = (settings?.logoUrl || "").trim();
  const tagline = settings ? L(lang, settings.tagline, settings.taglineEn) : "";
  const contact = settings?.contact;
  const social = settings?.social;

  const itemsCount = order.items.reduce((n, i) => n + i.qty, 0);
  const tone = TONE[order.status] || "info";
  const address = [order.customer.city, order.customer.address].filter((v) => (v || "").trim());
  /** تعقّب الأحرف يُباعد الحروف العربية عن بعضها — نطبّقه للأسماء اللاتينية فقط. */
  const latinName = /^[\x20-\x7E]+$/.test(storeName);

  const socials = social
    ? [social.instagram, social.tiktok, social.snapchat, social.facebook, social.x]
        .map((v) => (v || "").trim())
        .filter(Boolean)
    : [];

  return (
    <div className={`inv invoice-print${latinName ? " inv-latin" : ""}`} dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="inv-wm" aria-hidden>
        {storeName}
      </div>

      <div className="inv-body">
        {/* ---------- الترويسة ---------- */}
        <header className="inv-head">
          <div>
            {logo ? <img src={logo} alt={storeName} className="inv-logo" /> : null}
            <p className="inv-wordmark">{storeName}</p>
            {storeNameEn && storeNameEn !== storeName ? (
              <p className="inv-tagline" dir="ltr">
                {storeNameEn}
              </p>
            ) : null}
            {tagline ? <p className="inv-tagline">{tagline}</p> : null}
          </div>

          <div className="inv-doc">
            <p className={`inv-doc-label${lang === "en" ? " inv-doc-label-en" : ""}`}>
              {lang === "ar" ? "فاتورة" : "INVOICE"}
            </p>
            <p className="inv-doc-num">
              {t("invoiceNumberLabel")}
              <b dir="ltr">{order.number}</b>
            </p>
            <span className="inv-badge" data-tone={tone}>
              {t(statusLabelKey(order.status))}
            </span>
          </div>
        </header>

        <div className="inv-rule" aria-hidden>
          <span>◆</span>
        </div>

        {/* ---------- بيانات الفاتورة ---------- */}
        <dl className="inv-meta">
          <div className="inv-cell">
            <dt>{t("invoiceDate")}</dt>
            <dd>{formatDateTime(order.createdAt, lang)}</dd>
          </div>
          <div className="inv-cell">
            <dt>{t("invoiceOrderRef")}</dt>
            <dd dir="ltr">{order.number}</dd>
          </div>
          <div className="inv-cell">
            <dt>{t("invoiceItemsCount")}</dt>
            <dd>{itemsCount}</dd>
          </div>
          <div className="inv-cell">
            <dt>{t("invoicePayment")}</dt>
            <dd>{t("invoiceCod")}</dd>
          </div>
        </dl>

        {/* ---------- العميل والشحن ---------- */}
        <div className="inv-panels">
          <section className="inv-panel">
            <h4>{t("billTo")}</h4>
            <p>
              <span className="strong">{order.customer.name}</span>
              {order.customer.phone ? (
                <>
                  <br />
                  <span dir="ltr">{order.customer.phone}</span>
                </>
              ) : null}
              {order.customer.email ? (
                <>
                  <br />
                  <span dir="ltr">{order.customer.email}</span>
                </>
              ) : null}
            </p>
          </section>

          <section className="inv-panel">
            <h4>{t("shipTo")}</h4>
            <p>
              {address.length ? (
                address.map((line, i) => (
                  <span key={i}>
                    {i > 0 ? <br /> : null}
                    <span className={i === address.length - 1 ? "strong" : undefined}>{line}</span>
                  </span>
                ))
              ) : (
                <span>—</span>
              )}
              {order.customer.notes ? (
                <>
                  <br />
                  {t("deliveryNotes")}: {order.customer.notes}
                </>
              ) : null}
            </p>
          </section>
        </div>

        {/* ---------- الأصناف ---------- */}
        <div className="inv-items">
          <table>
            <thead>
              <tr>
                <th>{t("itemProduct")}</th>
                <th className="inv-col-qty">{t("qty")}</th>
                <th className="inv-col-price">{t("itemUnitPrice")}</th>
                <th>{t("total")}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, idx) => {
                const name = L(lang, item.name, item.nameEn);
                const chips = [item.variantLabel, ...Object.values(item.options || {})].filter(
                  (v) => (v || "").trim()
                );
                const hasCompare =
                  item.compareAtPrice != null && item.compareAtPrice > item.unitPrice;
                return (
                  <tr key={`${item.productId}-${item.variantId || idx}-${idx}`}>
                    <td>
                      <div className="inv-prod">
                        <Thumb src={item.image} label={name} />
                        <div>
                          <div className="inv-prod-name">{name}</div>
                          {item.nameEn && item.nameEn !== name ? (
                            <div className="inv-prod-en" dir="ltr">
                              {item.nameEn}
                            </div>
                          ) : null}
                          {chips.map((c, i) => (
                            <span className="inv-chip" key={i}>
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="inv-col-qty inv-num">{item.qty}</td>
                    <td className="inv-col-price inv-num">
                      {hasCompare ? (
                        <span className="inv-strike">
                          {formatMoney(item.compareAtPrice as number, settings)}
                        </span>
                      ) : null}
                      {formatMoney(item.unitPrice, settings)}
                    </td>
                    <td className="inv-num">{formatMoney(item.total, settings)}</td>
                  </tr>
                );
              })}
              {order.items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="inv-empty">
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {/* ---------- الإجماليات ---------- */}
        <div className="inv-totals">
          <div className="inv-trow">
            <span>{t("subtotal")}</span>
            <b>{formatMoney(order.subtotal, settings)}</b>
          </div>
          {order.discount > 0 ? (
            <div className="inv-trow">
              <span>{t("discount")}</span>
              <b>- {formatMoney(order.discount, settings)}</b>
            </div>
          ) : null}
          <div className="inv-trow">
            <span>{t("shipping")}</span>
            <b>{order.shipping > 0 ? formatMoney(order.shipping, settings) : t("free")}</b>
          </div>
          {order.tax > 0 ? (
            <div className="inv-trow">
              <span>{t("tax")}</span>
              <b>{formatMoney(order.tax, settings)}</b>
            </div>
          ) : null}
          <div className="inv-grand">
            <span>{t("total")}</span>
            <b>{formatMoney(order.total, settings)}</b>
          </div>
        </div>

        {/* ---------- التذييل ---------- */}
        <div className="inv-foot">
          <section>
            <h4>{t("contactInfoTitle")}</h4>
            <p>
              {contact?.phone ? (
                <>
                  <span dir="ltr">{contact.phone}</span>
                  <br />
                </>
              ) : null}
              {contact?.email ? (
                <>
                  <span dir="ltr">{contact.email}</span>
                  <br />
                </>
              ) : null}
              {L(lang, contact?.address || "", contact?.addressEn || "") || null}
              {contact?.workingHours ? <br /> : null}
              {contact?.workingHours ? <span>{contact.workingHours}</span> : null}
            </p>
            {socials.length ? (
              <p style={{ marginTop: 6 }} dir="ltr">
                {socials.map((s) => handle(s)).join("  ·  ")}
              </p>
            ) : null}
          </section>

          <section className="inv-terms">
            <h4>{t("invoiceTerms")}</h4>
            <ul>
              <li>{t("invoicePolicyShip")}</li>
              <li>{t("invoicePolicyReturn")}</li>
              <li>{t("invoiceKeepRef")}</li>
            </ul>
          </section>

          <div className="inv-seal" data-tone={tone}>
            <span>
              <b>{t(statusLabelKey(order.status))}</b>
              <i>{t("invoiceSeal")}</i>
            </span>
          </div>
        </div>

        <div className="inv-thanks">
          <b>
            {t("invoiceThanks")} {storeName}
          </b>
        </div>
        <p className="inv-note">{t("invoiceElectronic")}</p>
      </div>
    </div>
  );
}
