"use client";

import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { getJourneyOverview, JOURNEY_STAGES } from "@/lib/learn/journey";
import { LESSONS } from "@/lib/learn/curriculum";

interface StatDef {
  end: number;
  suffix: string;
  label: string;
  sub: string;
  gradient: string;
}

const journeyOverview = getJourneyOverview({});

const STATS: StatDef[] = [
  {
    end: LESSONS.length,
    suffix: "+",
    label: "Interactive lessons",
    sub: "live right now",
    gradient: "from-violet-400 to-blue-400",
  },
  {
    end: journeyOverview.availableModules,
    suffix: "",
    label: "Modules available",
    sub: "structured & in order",
    gradient: "from-blue-400 to-cyan-400",
  },
  {
    end: journeyOverview.totalRoadmapModules,
    suffix: "",
    label: "Modules planned",
    sub: "the full curriculum",
    gradient: "from-violet-400 to-purple-400",
  },
  {
    end: JOURNEY_STAGES.length,
    suffix: "",
    label: "Learning stages",
    sub: "fundamentals to advanced",
    gradient: "from-emerald-400 to-teal-400",
  },
];

function AnimatedNumber({
  end,
  suffix,
  trigger,
}: {
  end: number;
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
      {Math.round(val)}
      {suffix}
    </>
  );
}

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [triggered, setTriggered] = useState(false);
  const { ref: sectionRef, visible: sectionVisible } = useInView(0.2);

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
        {/* Section label */}
        <div
          ref={sectionRef}
          className={`text-center mb-10 scroll-reveal ${sectionVisible ? "visible" : ""}`}
        >
          <p className="text-[12px] uppercase tracking-widest text-muted-foreground/35 font-mono">
            The curriculum, by the numbers
          </p>
        </div>

        <div ref={ref} className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className={`text-center scroll-reveal scroll-delay-${i + 1} ${sectionVisible ? "visible" : ""}`}
            >
              <p
                className={`mb-1.5 text-5xl sm:text-6xl font-black tracking-tight tabular-nums text-transparent bg-clip-text bg-gradient-to-r ${s.gradient}`}
              >
                <AnimatedNumber end={s.end} suffix={s.suffix} trigger={triggered} />
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
