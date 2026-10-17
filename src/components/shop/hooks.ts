"use client";

import { useStore } from "@/lib/store-provider";
import type { Category, HomeSettings, StoreSettings } from "@/lib/types";

export interface SafeStore {
  ready: boolean;
  settings: StoreSettings | null;
  home: HomeSettings | null;
  categories: Category[];
  contactWaUrl: string;
  /** حقول إضافية قد يوفّرها الخادم (مثل تفعيل Google) */
  googleAuthEnabled: boolean;
}

/**
 * غلاف آمن حول useStore: يعيد قيمًا غير فارغة قبل اكتمال الجلب
 * حتى لا تنكسر الواجهة أثناء التحميل.
 */
export function useStoreSafe(): SafeStore {
  const store = useStore();
  const extended = store as unknown as { googleAuthEnabled?: boolean } | null;
  const ready = Boolean(store?.ready);
  return {
    ready,
    settings: (ready ? store.settings : null) as StoreSettings | null,
    home: (ready ? store.home : null) as HomeSettings | null,
    categories: (ready ? store.categories : []) as Category[],
    contactWaUrl: (ready ? store.contactWaUrl : "") || "",
    googleAuthEnabled: Boolean(extended?.googleAuthEnabled),
  };
}
