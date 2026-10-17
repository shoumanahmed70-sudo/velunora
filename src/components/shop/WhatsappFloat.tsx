"use client";

import { useT } from "@/lib/i18n/provider";
import { useStoreSafe } from "@/components/shop/hooks";
import { WhatsappIcon } from "@/components/shop/icons";

/** زر واتساب عائم ثابت أسفل الشاشة — يظهر فقط عند توفر الرابط. */
export function WhatsAppFloat() {
  const t = useT();
  const { contactWaUrl } = useStoreSafe();

  if (!contactWaUrl) return null;

  return (
    <a
      href={contactWaUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("whatsappContact")}
      title={t("whatsappContact")}
      className="no-print fixed bottom-5 end-5 z-40 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg transition-transform duration-300 ease-luxe hover:scale-105 hover:bg-emerald-600"
    >
      <WhatsappIcon size={26} />
    </a>
  );
}
