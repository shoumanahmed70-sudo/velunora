"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Category, HomeSettings, StoreSettings } from "@/lib/types";

export interface StorePayload {
  settings: StoreSettings;
  home: HomeSettings;
  categories: Category[];
  contactWaUrl: string;
}

interface Ctx extends StorePayload {
  ready: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const StoreCtx = createContext<Ctx | null>(null);

/** إعدادات المتجر العامة — تجلب مرة واحدة وتوزع على الواجهة. */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Omit<Ctx, "refetch">>({
    settings: null as unknown as StoreSettings,
    home: null as unknown as HomeSettings,
    categories: [],
    contactWaUrl: "#",
    ready: false,
    error: null,
  });

  const load = useCallback(async () => {
    try {
      const data = await api.get<StorePayload>("/api/store");
      setState({ ...data, ready: true, error: null });
    } catch (err) {
      setState((s) => ({ ...s, ready: true, error: "store_unavailable" }));
      void err;
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return <StoreCtx.Provider value={{ ...state, refetch: load }}>{children}</StoreCtx.Provider>;
}

export function useStore(): Ctx {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore outside StoreProvider");
  return ctx;
}
