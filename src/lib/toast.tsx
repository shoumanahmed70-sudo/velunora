"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface Ctx {
  toast: (message: string, tone?: ToastItem["tone"]) => void;
}

const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const toast = useCallback((message: string, tone: ToastItem["tone"] = "info") => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none no-print">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`reveal pointer-events-auto max-w-md rounded-full px-5 py-3 text-sm font-semibold shadow-xl ${
              t.tone === "success"
                ? "bg-emerald-700 text-white"
                : t.tone === "error"
                  ? "bg-red-700 text-white"
                  : "bg-primary text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx.toast;
}
