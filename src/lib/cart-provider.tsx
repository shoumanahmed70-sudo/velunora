"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { useMe } from "@/lib/auth-provider";
import { readCartLocal, takeGuestCart, writeCartLocal } from "@/lib/local-store";
import type { CartLine } from "@/lib/types";

const GUEST_KEY = "__guest__";

export function lineKey(line: Pick<CartLine, "productId" | "variantId" | "options">): string {
  const opts = Object.entries(line.options || {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join(",");
  return `${line.productId}|${line.variantId || ""}|${opts}`;
}

interface Ctx {
  lines: CartLine[];
  count: number;
  add: (line: CartLine) => void;
  setQty: (key: string, qty: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  ready: boolean;
}

const CartCtx = createContext<Ctx | null>(null);

function mergeLines(a: CartLine[], b: CartLine[]): CartLine[] {
  const map = new Map<string, CartLine>();
  for (const line of [...a, ...b]) {
    const key = lineKey(line);
    const existing = map.get(key);
    if (existing) existing.qty = Math.min(99, existing.qty + line.qty);
    else map.set(key, { ...line });
  }
  return [...map.values()];
}

/**
 * سلة العميل — مفصولة تمامًا لكل حساب:
 * - التخزين المحلي بمفتاح خاص بصاحب الحساب (انظر local-store.ts).
 * - سلة الخادم تُقرأ مرة واحدة عند الدخول ثم تُدمج، وبعدها فقط تتم المزامنة
 *   (حتى لا تُمسح سلة الحساب المحفوظة قبل قراءتها).
 * - سلة الزائر تُنقل إلى الحساب عند أول تسجيل دخول وتُحذف من مفتاح الزائر.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { me, loading: meLoading } = useMe();
  const uid = me?.user?.uid ?? null;
  const currentKey = uid ?? GUEST_KEY;

  // المفتاح محفوظ مع السطور معًا حتى لا تُكتب سلة حساب في مفتاح حساب آخر
  const [state, setState] = useState<{ key: string; lines: CartLine[] }>({
    key: GUEST_KEY,
    lines: [],
  });
  const [remoteReady, setRemoteReady] = useState(false);

  const ready = !meLoading && state.key === currentKey;

  // 1) تحميل سلة صاحب الحساب الحالي عند تغيّر الحساب
  useEffect(() => {
    if (meLoading) return;
    if (state.key === currentKey) return;

    let next = readCartLocal(uid);
    if (uid) {
      const guest = takeGuestCart();
      if (guest.length) next = mergeLines(guest, next);
    }
    setState({ key: currentKey, lines: next });
    setRemoteReady(false);
  }, [meLoading, currentKey, uid, state.key]);

  // 2) حفظ محلي في مفتاح صاحب الحساب فقط
  useEffect(() => {
    if (state.key !== currentKey) return;
    writeCartLocal(uid, state.lines);
  }, [state, currentKey, uid]);

  // 3) دمج سلة الخادم مرة واحدة عند الدخول
  useEffect(() => {
    if (!ready) return;
    if (!uid) {
      setRemoteReady(true);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const remote = await api.get<{ lines: CartLine[] }>("/api/account/cart");
        if (!cancelled && remote.lines?.length) {
          setState((s) => (s.key === uid ? { ...s, lines: mergeLines(s.lines, remote.lines) } : s));
        }
      } catch {
        /* في حال فشل الجلب نحتفظ بالسلة المحلية */
      } finally {
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, uid]);

  // 4) مزامنة دورية إلى الخادم — بعد اكتمال الدمج فقط
  useEffect(() => {
    if (!ready || !uid || !remoteReady) return;
    const timer = setTimeout(() => {
      api.put("/api/account/cart", { lines: state.lines }).catch(() => undefined);
    }, 700);
    return () => clearTimeout(timer);
  }, [state.lines, ready, uid, remoteReady]);

  const add = useCallback((line: CartLine) => {
    setState((s) => {
      const key = lineKey(line);
      const idx = s.lines.findIndex((l) => lineKey(l) === key);
      if (idx >= 0) {
        const next = [...s.lines];
        next[idx] = { ...next[idx], qty: Math.min(99, next[idx].qty + line.qty) };
        return { ...s, lines: next };
      }
      return { ...s, lines: [...s.lines, { ...line, qty: Math.min(99, line.qty) }] };
    });
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setState((s) => ({
      ...s,
      lines:
        qty <= 0
          ? s.lines.filter((l) => lineKey(l) !== key)
          : s.lines.map((l) => (lineKey(l) === key ? { ...l, qty: Math.min(99, qty) } : l)),
    }));
  }, []);

  const remove = useCallback((key: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => lineKey(l) !== key) }));
  }, []);

  const clear = useCallback(() => setState((s) => ({ ...s, lines: [] })), []);

  const count = useMemo(() => state.lines.reduce((sum, l) => sum + l.qty, 0), [state.lines]);

  return (
    <CartCtx.Provider
      value={{ lines: state.lines, count, add, setQty, remove, clear, ready }}
    >
      {children}
    </CartCtx.Provider>
  );
}

export function useCart(): Ctx {
  const ctx = useContext(CartCtx);
  if (!ctx) throw new Error("useCart outside CartProvider");
  return ctx;
}
