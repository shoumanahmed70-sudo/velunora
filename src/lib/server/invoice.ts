import "server-only";

import type { Order, StoreSettings } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/order-status";
import { publicBaseUrl } from "@/lib/server/url";

/**
 * بناء الفاتورة (نص + HTML) على الخادم فقط.
 * - النص يُستخدم للواتساب أو أي قناة نصية.
 * - HTML يُستخدم في رسالة البريد (SMTP) بغرض الطباعة أو الحفظ كـ PDF.
 * لا تُبنى أي فاتورة في الواجهة اعتمادًا على أسعار العميل؛ القيم كلها من الطلب المحفوظ.
 */

function money(amount: number, settings: StoreSettings): string {
  const value = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount || 0);
  return `${value} ${settings.currencySymbol}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function moneyPlain(amount: number, settings: StoreSettings): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount || 0)} ${settings.currencySymbol}`;
}

/** نص فاتورة مبسّط يصلح للواتساب أو النسخ اليدوي. */
export function buildInvoiceText(order: Order, settings: StoreSettings): string {
  const lines: string[] = [];
  lines.push(`*فاتورة ${settings.storeName}*`);
  lines.push(`رقم الفاتورة: ${order.number}`);
  lines.push(`التاريخ: ${formatOrderDate(order.createdAt)}`);
  lines.push(`الحالة: ${STATUS_LABELS[order.status]}`);
  lines.push("");
  lines.push("*المنتجات:*");
  order.items.forEach((item, index) => {
    const variant = item.variantLabel ? ` — ${item.variantLabel}` : "";
    lines.push(`${index + 1}) ${item.name}${variant}`);
    lines.push(`   ${item.qty} × ${money(item.unitPrice, settings)} = ${money(item.total, settings)}`);
  });
  lines.push("");
  lines.push(`المجموع الفرعي: ${money(order.subtotal, settings)}`);
  if (order.discount > 0) lines.push(`الخصم: -${money(order.discount, settings)}`);
  lines.push(`الشحن: ${order.shipping > 0 ? money(order.shipping, settings) : "مجاني"}`);
  if (order.tax > 0) lines.push(`الضريبة: ${money(order.tax, settings)}`);
  lines.push(`*الإجمالي: ${money(order.total, settings)}*`);
  lines.push("");
  lines.push(`العميل: ${order.customer.name}`);
  lines.push(`الجوال: ${order.customer.phone}`);
  if (order.customer.city || order.customer.address) {
    lines.push(`العنوان: ${[order.customer.city, order.customer.address].filter(Boolean).join(" — ")}`);
  }
  const contact = [settings.contact.phone, settings.contact.email].filter(Boolean).join(" | ");
  if (contact) {
    lines.push("");
    lines.push(`للتواصل: ${contact}`);
  }
  lines.push(`شكرًا لتعاملك مع ${settings.storeName}.`);
  return lines.join("\n");
}

function formatOrderDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** رابط مطلق لصورة الصنف — برامج البريد لا تفهم المسارات النسبية. */
function absImage(base: string, path: string | null | undefined): string {
  const p = (path || "").trim();
  if (!p) return "";
  if (/^https?:\/\//i.test(p)) return p;
  if (!p.startsWith("/")) return "";
  return `${base}${p}`;
}

/* لوحة الفاتورة في البريد (مطابقة لهوية المتجر الداكنة). */
const C = {
  bg: "#0d0720",
  bg1: "#17102c",
  cell: "#1e1640",
  head: "#241a44",
  line: "#372663",
  rowLine: "#2a2149",
  ink: "#f6f0ff",
  muted: "#bcabdd",
  gold: "#d9b877",
  goldSoft: "#f3dfae",
  goldLine: "#a98c5e",
} as const;

const TONE: Record<string, { fg: string; bg: string }> = {
  new: { fg: "#f8d98a", bg: "#3a2e12" },
  pending: { fg: "#f8d98a", bg: "#3a2e12" },
  confirmed: { fg: "#f3dfae", bg: "#37290f" },
  processing: { fg: "#f3dfae", bg: "#37290f" },
  shipped: { fg: "#f3dfae", bg: "#37290f" },
  completed: { fg: "#9df0cb", bg: "#123a2c" },
  cancelled: { fg: "#fca5a5", bg: "#3a1620" },
};

/**
 * فاتورة HTML كاملة (RTL) جاهزة للإرسال عبر البريد.
 * `async` لأن روابط صور المنتجات تحتاج النطاق العام الحالي.
 */
export async function buildInvoiceHtml(order: Order, settings: StoreSettings): Promise<string> {
  const base = await publicBaseUrl();
  const logo = absImage(base, settings.logoUrl);
  const storeName = settings.storeName || "VELUNORA";
  const tone = TONE[order.status] || TONE.confirmed;
  const statusLabel = esc(STATUS_LABELS[order.status]);
  const itemsCount = order.items.reduce((n, i) => n + i.qty, 0);
  /** تعقّب الأحرف يُباعد الحروف العربية — لاتيني فقط. */
  const nameTracking = /^[\x20-\x7E]+$/.test(storeName) ? "letter-spacing:4px;" : "";

  /* ---------- الأصناف ---------- */
  const rows = order.items
    .map((item) => {
      const image = absImage(base, item.image);
      const chips = [item.variantLabel, ...Object.values(item.options || {})]
        .filter((v) => v && String(v).trim())
        .map(
          (v) =>
            `<span style="display:inline-block;margin:3px 5px 0 5px;padding:1px 8px;border:1px solid ${C.goldLine};border-radius:10px;font-size:10px;color:${C.goldSoft};">${esc(
              v
            )}</span>`
        )
        .join("");
      const visual = image
        ? `<img src="${esc(image)}" width="38" height="38" alt="" style="display:block;width:38px;height:38px;border:1px solid ${
            C.line
          };border-radius:8px;"/>`
        : `<div style="width:38px;height:38px;line-height:36px;text-align:center;background-color:#0b0616;border:1px solid ${
            C.line
          };border-radius:8px;color:${C.gold};font-size:16px;font-weight:bold;">${esc(
            (item.name || "V").trim().charAt(0)
          )}</div>`;
      const compare =
        item.compareAtPrice != null && item.compareAtPrice > item.unitPrice
          ? `<div style="font-size:11px;color:${C.muted};text-decoration:line-through;">${esc(
              money(item.compareAtPrice, settings)
            )}</div>`
          : "";
      return `<tr>
        <td style="padding:11px 12px;border-top:1px solid ${C.rowLine};">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td style="padding-left:10px;" valign="middle">${visual}</td>
              <td valign="middle" style="font-size:13px;color:${C.ink};">
                <div style="font-weight:bold;">${esc(item.name)}</div>
                ${item.nameEn ? `<div style="font-size:11px;color:${C.muted};">${esc(item.nameEn)}</div>` : ""}
                ${chips ? `<div>${chips}</div>` : ""}
              </td>
            </tr>
          </table>
        </td>
        <td align="center" style="padding:11px 8px;border-top:1px solid ${C.rowLine};font-size:13px;color:${C.ink};">${
          item.qty
        }</td>
        <td align="center" style="padding:11px 8px;border-top:1px solid ${C.rowLine};font-size:13px;color:${C.muted};direction:ltr;">${compare}${esc(
          money(item.unitPrice, settings)
        )}</td>
        <td align="left" style="padding:11px 12px;border-top:1px solid ${C.rowLine};font-size:13px;font-weight:bold;color:${
          C.ink
        };direction:ltr;">${esc(money(item.total, settings))}</td>
      </tr>`;
    })
    .join("");

  /* ---------- الإجماليات ---------- */
  const totRow = (label: string, value: string, color: string = C.ink) =>
    `<tr>
      <td align="right" style="padding:5px 2px;font-size:13px;color:${C.muted};">${esc(label)}</td>
      <td align="left" style="padding:5px 2px;font-size:13px;font-weight:bold;color:${color};direction:ltr;">${value}</td>
    </tr>`;

  const totals: string[] = [totRow("المجموع الفرعي", esc(money(order.subtotal, settings)))];
  if (order.discount > 0) {
    totals.push(totRow("الخصم", `- ${esc(money(order.discount, settings))}`, "#9df0cb"));
  }
  totals.push(
    totRow("الشحن", esc(order.shipping > 0 ? money(order.shipping, settings) : "مجاني"))
  );
  if (order.tax > 0) totals.push(totRow("الضريبة", esc(money(order.tax, settings))));

  /* ---------- بيانات الفاتورة ---------- */
  const metaCell = (label: string, value: string) =>
    `<td width="50%" bgcolor="${C.cell}" style="padding:10px 14px;">
      <div style="font-size:11px;color:${C.muted};word-spacing:2px;">${esc(label)}</div>
      <div style="font-size:14px;font-weight:bold;color:${C.ink};margin-top:4px;">${value}</div>
    </td>`;

  const address = [order.customer.city, order.customer.address].filter(Boolean).join(" — ");
  const contactLines = [settings.contact?.phone, settings.contact?.email, settings.contact?.address]
    .filter(Boolean)
    .map((line) => `<div style="font-size:12px;color:${C.muted};line-height:1.9;">${esc(line)}</div>`)
    .join("");

  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><meta name="color-scheme" content="dark light"/><title>فاتورة ${esc(
    order.number
  )}</title></head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:Tahoma,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.bg}">
    <tr><td align="center" style="padding:24px 12px;">
      <table role="presentation" width="680" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:680px;">
        <tr><td>
          <!-- الإطار الذهبي المزدوج -->
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.bg}" style="border:1px solid ${C.goldLine};border-radius:16px;">
            <tr><td style="padding:6px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${C.bg1}" style="border:1px solid ${C.head};border-radius:12px;">
                <tr><td style="padding:22px 20px 18px;">

                  <!-- الترويسة -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td valign="top">
                        ${
                          logo
                            ? `<img src="${esc(
                                logo
                              )}" alt="" style="display:block;height:38px;width:auto;margin-bottom:6px;border:0;"/>`
                            : ""
                        }
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:bold;color:#ffffff;${nameTracking}">${esc(
                          storeName
                        )}</div>
                        ${
                          settings.tagline
                            ? `<div style="font-size:12px;color:${C.muted};margin-top:7px;line-height:1.8;">${esc(
                                settings.tagline
                              )}</div>`
                            : ""
                        }
                      </td>
                      <td align="left" valign="top" style="text-align:left;">
                        <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;color:${C.gold};">فاتورة</div>
                        <div style="font-size:11px;color:${C.muted};margin-top:8px;word-spacing:2px;">رقم الفاتورة</div>
                        <div style="font-size:15px;font-weight:bold;color:${C.ink};direction:ltr;">${esc(order.number)}</div>
                        <span style="display:inline-block;margin-top:10px;padding:4px 12px;border:1px solid ${
                          tone.fg
                        };border-radius:20px;background-color:${tone.bg};color:${tone.fg};font-size:12px;font-weight:bold;">${statusLabel}</span>
                      </td>
                    </tr>
                  </table>

                  <!-- فاصل ذهبي -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:16px 0;">
                    <tr>
                      <td style="border-top:1px solid ${C.goldLine};font-size:0;line-height:0;">&nbsp;</td>
                      <td width="20" align="center" style="font-size:9px;color:${C.gold};padding:0 8px;">&#9670;</td>
                      <td style="border-top:1px solid ${C.goldLine};font-size:0;line-height:0;">&nbsp;</td>
                    </tr>
                  </table>

                  <!-- بيانات الفاتورة -->
                  <table role="presentation" width="100%" cellspacing="1" cellpadding="0" border="0" bgcolor="${C.line}">
                    <tr>
                      ${metaCell("تاريخ الإصدار", esc(formatDate(order.createdAt)))}
                      ${metaCell("رقم الطلب", `<span dir="ltr">${esc(order.number)}</span>`)}
                    </tr>
                    <tr>
                      ${metaCell("عدد القطع", String(itemsCount))}
                      ${metaCell("طريقة الدفع", "الدفع عند الاستلام")}
                    </tr>
                  </table>

                  <!-- العميل والشحن -->
                  <table role="presentation" width="100%" cellspacing="12" cellpadding="0" border="0" style="margin-top:14px;">
                    <tr>
                      <td width="50%" valign="top" bgcolor="${C.cell}" style="padding:14px 16px;border:1px solid ${
    C.line
  };border-radius:10px;font-size:13px;line-height:2;color:${C.muted};">
                        <div style="font-size:11px;color:${C.gold};margin-bottom:7px;word-spacing:2px;">بيانات العميل</div>
                        <div style="font-weight:bold;color:${C.ink};">${esc(order.customer.name)}</div>
                        <div dir="ltr">${esc(order.customer.phone)}</div>
                        ${order.customer.email ? `<div dir="ltr">${esc(order.customer.email)}</div>` : ""}
                      </td>
                      <td width="50%" valign="top" bgcolor="${C.cell}" style="padding:14px 16px;border:1px solid ${
    C.line
  };border-radius:10px;font-size:13px;line-height:2;color:${C.muted};">
                        <div style="font-size:11px;color:${C.gold};margin-bottom:7px;word-spacing:2px;">عنوان الشحن</div>
                        <div style="color:${C.ink};">${esc(address || "—")}</div>
                        ${
                          order.customer.notes
                            ? `<div style="margin-top:4px;">ملاحظات التوصيل: ${esc(order.customer.notes)}</div>`
                            : ""
                        }
                      </td>
                    </tr>
                  </table>

                  <!-- الأصناف -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;border:1px solid ${
                    C.line
                  };">
                    <tr bgcolor="${C.head}">
                      <th align="right" style="padding:10px 12px;font-size:11px;font-weight:bold;color:${
                        C.goldSoft
                      };border-bottom:1px solid ${C.line};word-spacing:2px;">المنتج</th>
                      <th align="center" style="padding:10px 8px;font-size:11px;font-weight:bold;color:${
                        C.goldSoft
                      };border-bottom:1px solid ${C.line};">الكمية</th>
                      <th align="center" style="padding:10px 8px;font-size:11px;font-weight:bold;color:${
                        C.goldSoft
                      };border-bottom:1px solid ${C.line};">السعر</th>
                      <th align="left" style="padding:10px 12px;font-size:11px;font-weight:bold;color:${
                        C.goldSoft
                      };border-bottom:1px solid ${C.line};">الإجمالي</th>
                    </tr>
                    ${rows}
                  </table>

                  <!-- الإجماليات -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:16px;">
                    ${totals.join("")}
                  </table>
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;">
                    <tr>
                      <td bgcolor="#37290f" style="background-color:#37290f;border:1px solid ${
                        C.goldLine
                      };border-radius:10px;padding:12px 16px;">
                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td align="right" style="font-size:14px;font-weight:bold;color:${C.ink};">الإجمالي</td>
                            <td align="left" style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:bold;color:${
                              C.goldSoft
                            };direction:ltr;">${esc(money(order.total, settings))}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- التذييل: تواصل + شروط -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;border-top:1px solid ${C.line};">
                    <tr>
                      <td width="50%" valign="top" style="padding-top:16px;">
                        <div style="font-size:11px;color:${C.gold};margin-bottom:7px;word-spacing:2px;">للتواصل معنا</div>
                        ${contactLines || `<div style="font-size:12px;color:${C.muted};">${esc(storeName)}</div>`}
                      </td>
                      <td width="50%" valign="top" style="padding-top:16px;">
                        <div style="font-size:11px;color:${C.gold};margin-bottom:7px;word-spacing:2px;">الشروط والإرشادات</div>
                        <div style="font-size:12px;color:${C.muted};line-height:2;">
                          &#9670; يتم التوصيل خلال ٢-٥ أيام عمل.<br/>
                          &#9670; الاستبدال خلال ١٤ يومًا وفق سياسة الاسترجاع.<br/>
                          &#9670; احتفظ بالفاتورة كمرجع عند التواصل معنا.
                        </div>
                      </td>
                    </tr>
                  </table>

                  <!-- الختم -->
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;">
                    <tr>
                      <td align="center">
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                          <tr>
                            <td width="96" height="96" align="center" valign="middle" style="width:96px;height:96px;border:2px solid ${
                              tone.fg
                            };border-radius:50%;text-align:center;">
                              <div style="font-size:13px;font-weight:bold;color:${tone.fg};word-spacing:1px;">${statusLabel}</div>
                              <div style="font-size:9px;color:${C.muted};margin-top:4px;word-spacing:2px;">ختم المتجر</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- زر المتجر -->
                  <table role="presentation" align="center" cellspacing="0" cellpadding="0" border="0" style="margin:18px auto 0 auto;">
                    <tr>
                      <td bgcolor="${C.goldLine}" style="background-color:${C.goldLine};border-radius:999px;padding:11px 26px;">
                        <a href="${esc(
                          `${base}/order/lookup`
                        )}" style="display:inline-block;color:#2b1c0a;font-size:13px;font-weight:bold;text-decoration:none;word-spacing:2px;">متابعة الطلب في المتجر</a>
                      </td>
                    </tr>
                  </table>

                  <div style="text-align:center;margin-top:18px;font-family:Georgia,'Times New Roman',serif;font-size:17px;color:${
                    C.goldSoft
                  };word-spacing:3px;">شكرًا لاختيارك ${esc(storeName)}</div>
                  <div style="text-align:center;margin-top:10px;padding-top:10px;border-top:1px dashed ${C.goldLine};font-size:11px;color:#9f90c6;line-height:2;">فاتورة إلكترونية صادرة آليًا — لا تحتاج إلى توقيع.<br/>يمكنك طباعتها أو حفظها كملف PDF من خيارات الطباعة.</div>

                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** اسم ملف آمن لتنزيل الفاتورة. */
export function invoiceFileName(order: Order): string {
  const safe = order.number.replace(/[^A-Za-z0-9-]/g, "-");
  return `invoice-${safe}.html`;
}

export { money as formatInvoiceMoney, formatOrderDate };
