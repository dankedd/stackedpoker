"use client";

import { useEffect, useRef, useState } from "react";

interface StatDef {
  end: number;
  decimals?: number;
  suffix: string;
  label: string;
  sub: string;
  gradient: string;
}

const STATS: StatDef[] = [
  {
    end: 50,
    suffix: "K+",
    label: "Hands analyzed",
    sub: "and counting",
    gradient: "from-violet-400 to-blue-400",
  },
  {
    end: 4.8,
    decimals: 1,
    suffix: "s",
    label: "Avg analysis time",
    sub: "end-to-end",
    gradient: "from-blue-400 to-cyan-400",
  },
  {
    end: 12,
    suffix: "+",
    label: "Spot categories",
    sub: "auto-classified",
    gradient: "from-violet-400 to-purple-400",
  },
  {
    end: 3,
    suffix: "",
    label: "Free analyses",
    sub: "no card required",
    gradient: "from-emerald-400 to-teal-400",
  },
];

function AnimatedNumber({
  end,
  decimals = 0,
  suffix,
  trigger,
}: {
  end: number;
  decimals?: number;
  suffix: string;
  trigger: boolean;
}) {
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!trigger) return;
    let raf: number;
    const dur = 1400;
    const t0 = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(end * eased);
      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        setVal(end);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trigger, end]);

  return (
    <>
      {decimals ? val.toFixed(decimals) : Math.round(val)}
      {suffix}
    </>
  );
}

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTriggered(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="relative py-20 sm:py-28 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(124,92,255,0.09) 0%, transparent 65%)",
        }}
      />

      {/* Divider lines */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div ref={ref} className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="text-center">
              <p
                className={`mb-1.5 text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-r ${s.gradient}`}
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <AnimatedNumber
                  end={s.end}
                  decimals={s.decimals}
                  suffix={s.suffix}
                  trigger={triggered}
                />
              </p>
              <p className="text-[14px] font-semibold text-foreground/70">{s.label}</p>
              <p className="text-[11px] text-muted-foreground/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
