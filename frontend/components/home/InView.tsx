"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Drives the homepage motion system (globals.css, "Homepage — motion system"):
 *  - `hp-in`   added once, the first time the element scrolls into view;
 *  - `hp-live` present while it is in view AND the tab is visible, so looping
 *              animations pause off-screen and in background tabs.
 * `onEnter` fires once, together with `hp-in`.
 */
export function InView({
  as: Tag = "div",
  className,
  children,
  threshold = 0.2,
  onEnter,
  id,
}: {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  threshold?: number;
  onEnter?: () => void;
  id?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [seen, setSeen] = useState(false);
  const [live, setLive] = useState(false);
  const seenRef = useRef(false);
  const entered = useRef(onEnter);
  entered.current = onEnter;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const update = () => setLive(visible && document.visibilityState === "visible");
    const obs = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
        if (visible && !seenRef.current) {
          seenRef.current = true;
          setSeen(true);
          entered.current?.();
        }
        update();
      },
      { threshold },
    );
    obs.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      obs.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, [threshold]);

  return (
    <Tag ref={ref} id={id} className={cn(className, seen && "hp-in", live && "hp-live")}>
      {children}
    </Tag>
  );
}

/** Ease-out count from 0 to `to` once `run` turns true (instant under reduced motion). */
export function useCountUp(to: number, run: boolean, ms = 900): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setV(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run, ms]);
  return v;
}
