"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { dict, makeT, type Lang, type TKey } from "@/lib/i18n/dict";

const COOKIE = "vn_lang";

interface Ctx {
  lang: Lang;
  dir: "rtl" | "ltr";
  setLang: (l: Lang) => void;
  t: (key: TKey) => string;
}

const LangCtx = createContext<Ctx | null>(null);

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    const cookie = readCookie(COOKIE) as Lang | null;
    if (cookie && cookie !== lang && (cookie === "ar" || cookie === "en")) setLang(cookie);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback((key: TKey) => makeT(lang)(key), [lang]);

  return (
    <LangCtx.Provider value={{ lang, dir: lang === "ar" ? "rtl" : "ltr", setLang, t }}>
      {children}
    </LangCtx.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useLang outside LangProvider");
  return { lang: ctx.lang, setLang: ctx.setLang };
}

export function useT() {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error("useT outside LangProvider");
  return ctx.t;
}

export function useDir() {
  const ctx = useContext(LangCtx);
  return ctx?.dir ?? "rtl";
}

export const LOCALES: Record<Lang, string> = { ar: "ar-SA", en: "en-US" };
export { dict };
