"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";

/**
 * أدوات التأثيرات البصرية الفاخرة (3D).
 * - كل الحركة عبر transform فقط (GPU) مع طلب إطار واحد (rAF).
 * - تُحترم إعدادات المستخدم: prefers-reduced-motion + الأجهزة اللمسية.
 */

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function hasFinePointer(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: fine)").matches;
}

/** ظهور تدريجي ناعم عند وصول العنصر إلى الشاشة. */
export function Reveal({
  children,
  delay = 0,
  y = 26,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`rv ${shown ? "rv-in" : ""} ${className}`.trim()}
      style={{ transitionDelay: `${delay}ms`, "--rv-y": `${y}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * ميلان ثلاثي الأبعاد يتبع مؤشّر الفأرة + لمعة ضوئية.
 * يُعيّن --mx/--my على العنصر ويُفعّل الصنف is-tilt؛ الشكل النهائي في CSS.
 */
export function useTilt<T extends HTMLElement>(max = 8) {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<T>) => {
      const el = ref.current;
      if (!el || event.pointerType !== "mouse" || prefersReducedMotion()) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const mx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const my = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      el.style.setProperty("--mx", mx.toFixed(4));
      el.style.setProperty("--my", my.toFixed(4));
      el.classList.add("is-tilt");
    },
    []
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.classList.remove("is-tilt");
    el.style.setProperty("--mx", "0");
    el.style.setProperty("--my", "0");
  }, []);

  return { ref, max, onPointerMove, onPointerLeave };
}

/** غلاف جاهز للميلان ثلاثي الأبعاد. */
export function Tilt({
  children,
  className = "",
  max = 8,
  style,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  style?: CSSProperties;
}) {
  const tilt = useTilt<HTMLDivElement>(max);
  return (
    <div
      ref={tilt.ref}
      className={`tilt ${className}`.trim()}
      style={{ ...style, "--tilt-max": `${max}deg` } as CSSProperties}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
    >
      {children}
    </div>
  );
}

/** إزاحة رأسية أثناء التمرير (parallax) عبر متغيّر --sy. */
export function useScrollParallax<T extends HTMLElement>(strength = 40) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const p = 1 - center / (vh / 2 + rect.height / 2);
      el.style.setProperty("--sy", `${(Math.max(-1, Math.min(1, p)) * strength).toFixed(2)}px`);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [strength]);

  return ref;
}

/**
 * يجمع parallax المؤشّر (--px/--py) والتمرير (--sy) على عنصر واحد.
 * مناسب للأقسام الغنية بطبقات متعدّدة (البطل مثلاً).
 */
export function useLayerParallax<T extends HTMLElement>(scrollStrength = 40) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const fine = hasFinePointer();
    let raf = 0;
    let nx = 0;
    let ny = 0;
    let moved = false;

    const apply = () => {
      raf = 0;
      if (moved) {
        el.style.setProperty("--px", nx.toFixed(4));
        el.style.setProperty("--py", ny.toFixed(4));
        moved = false;
      }
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const center = rect.top + rect.height / 2;
      const p = Math.max(-1, Math.min(1, 1 - center / (vh / 2 + rect.height / 2)));
      el.style.setProperty("--sy", `${(p * scrollStrength).toFixed(2)}px`);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent) => {
      if (!fine) return;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      moved = true;
      schedule();
    };
    const onLeave = () => {
      nx = 0;
      ny = 0;
      moved = true;
      schedule();
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    apply();
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollStrength]);

  return ref;
}

/**
 * parallax يتبع مؤشّر الفأرة لحاوية البطل: يُعيّن --px/--py في المجال [-1, 1].
 */
export function usePointerParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion() || !hasFinePointer()) return;
    let raf = 0;
    let nx = 0;
    let ny = 0;
    const apply = () => {
      raf = 0;
      el.style.setProperty("--px", nx.toFixed(4));
      el.style.setProperty("--py", ny.toFixed(4));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
      schedule();
    };
    const onLeave = () => {
      nx = 0;
      ny = 0;
      schedule();
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return ref;
}
