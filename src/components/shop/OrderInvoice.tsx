"use client";

import { useState } from "react";
import { Printer, Receipt, Send } from "lucide-react";
import { useLang, useT } from "@/lib/i18n/provider";
import { useApi, errorMessage } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import type { PublicOrder } from "@/lib/types";
import { useStoreSafe } from "@/components/shop/hooks";
import { InvoiceDocument } from "@/components/invoice/InvoiceDocument";

interface Props {
  order: PublicOrder;
  /** رقم الجوال للتحقق عند الإرسال بالبريد (مطلوب لغير المسجّلين). */
  phone?: string;
}

type MailState = "idle" | "sending" | "sent" | "disabled" | "error";

/**
 * فاتورة العميل: مستند قابل للطباعة/الحفظ كـ PDF + إرسال نسخة إلى البريد.
 * الطباعة تعزل الفاتورة عن باقي الصفحة عبر صنف `invoice-print`.
 */
export function OrderInvoice({ order, phone }: Props) {
  const { lang } = useLang();
  const t = useT();
  const api = useApi();
  const { settings } = useStoreSafe();
  const { me } = useMe();

  // صاحب الطلب (المسجّل) وحده يستطيع تحديد بريد حرّ؛ غيره يُرسَل إلى البريد المسجّل.
  const registeredEmail = order.customer.email || "";
  const isOwner = Boolean(me?.user?.uid && order.uid && me.user.uid === order.uid);

  const [email, setEmail] = useState(registeredEmail);
  const [state, setState] = useState<MailState>("idle");
  const [message, setMessage] = useState("");

  /** ينتظر تحميل صور الفاتورة ثم يطبع — وإلا ظهرت مربعات فارغة في الورقة. */
  function printInvoice() {
    const doPrint = () => {
      document.body.classList.add("printing-invoice");
      const cleanup = () => {
        document.body.classList.remove("printing-invoice");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      window.print();
    };

    const pending = Array.from(
      document.querySelectorAll<HTMLImageElement>(".invoice-print img")
    ).filter((img) => !img.complete);
    if (pending.length === 0) {
      doPrint();
      return;
    }
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            window.setTimeout(done, 1500);
          })
      )
    ).then(doPrint);
  }

  async function sendToEmail() {
    if (state === "sending") return;
    setState("sending");
    setMessage("");
    try {
      const res = await api.post<{ sent: boolean; reason?: string }>("/api/orders/invoice", {
        number: order.number,
        phone,
        email: email.trim() || undefined,
      });
      if (res.sent) {
        setState("sent");
        setMessage(t("emailInvoiceSent"));
      } else if (res.reason === "disabled") {
        setState("disabled");
        setMessage(t("emailInvoiceDisabled"));
      } else {
        setState("error");
        setMessage(t("emailInvoiceFailed"));
      }
    } catch (err) {
      setState("error");
      setMessage(errorMessage(err, t("emailInvoiceFailed")));
    }
  }

  return (
    <section className="mt-8">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-2 text-base font-bold text-ink">
          <Receipt className="h-5 w-5 text-gold" />
          {t("invoice")}
          <span dir="ltr" className="text-primary">
            {order.number}
          </span>
        </h2>
        <button type="button" onClick={printInvoice} className="btn btn-gold min-h-11 px-5">
          <Printer className="h-4 w-4" />
          {t("downloadInvoice")}
        </button>
      </div>

      <InvoiceDocument order={order} settings={settings} lang={lang} />

      <div className="no-print mt-5 rounded-2xl border border-line bg-cream/50 p-5">
        <label className="mb-2 block text-sm font-semibold text-ink" htmlFor={`inv-email-${order.id}`}>
          {t("emailInvoice")}
        </label>
        {isOwner ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id={`inv-email-${order.id}`}
              type="email"
              inputMode="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="field flex-1 text-start"
            />
            <button
              type="button"
              onClick={() => void sendToEmail()}
              disabled={state === "sending"}
              className="btn btn-primary min-h-11 px-5"
            >
              <Send className="h-4 w-4" />
              {state === "sending" ? t("sending") : t("emailInvoice")}
            </button>
          </div>
        ) : registeredEmail ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p
              className="flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm text-ink"
              data-testid="invoice-registered-email"
            >
              {t("emailInvoiceRegistered")} <span dir="ltr" className="font-semibold text-primary">{registeredEmail}</span>
            </p>
            <button
              type="button"
              onClick={() => void sendToEmail()}
              disabled={state === "sending"}
              className="btn btn-primary min-h-11 px-5"
            >
              <Send className="h-4 w-4" />
              {state === "sending" ? t("sending") : t("emailInvoice")}
            </button>
          </div>
        ) : (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {t("emailInvoiceLoginOther")}
          </p>
        )}
        {message ? (
          <p
            className={`mt-2 text-sm font-semibold ${
              state === "sent" ? "text-emerald-700" : state === "disabled" ? "text-amber-700" : "text-red-700"
            }`}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
