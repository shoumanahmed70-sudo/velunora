"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { MeResponse } from "@/lib/types";

interface Ctx {
  me: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const MeCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<MeResponse>("/api/auth/me");
      setMe(data);
    } catch {
      setMe({ user: null, admin: null });
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      setMe({ user: null, admin: null });
      // إعادة الجلب للتأكد من تنظيف أي حالة متبقية
      void refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <MeCtx.Provider value={{ me, loading, refresh, logout }}>{children}</MeCtx.Provider>;
}

export function useMe(): Ctx {
  const ctx = useContext(MeCtx);
  if (!ctx) throw new Error("useMe outside AuthProvider");
  return ctx;
}
