import { Crosshair, Bot, LineChart, PlayCircle } from "lucide-react";
import { InView } from "./InView";

const STEPS = [
  { icon: Crosshair, title: "Drill", text: "A preflop trainer for opens, defenses and push/fold — MTT and cash — graded against full ranges." },
  { icon: PlayCircle, title: "Review", text: "Import your hand histories and replay every hand street by street, with your preflop checked." },
  { icon: Bot, title: "Ask", text: "An AI coach that knows the hand you're looking at and explains the costly decisions." },
  { icon: LineChart, title: "Track", text: "A bankroll tracker with sessions, goals and AI insights." },
];

/** "One loop to get better" — four steps joined by a line that draws itself. */
export function Loop() {
  return (
    <section id="how-it-works" aria-labelledby="loop-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <InView>
        <h2 id="loop-title" className="hp-reveal text-center text-3xl font-black tracking-tight text-white sm:text-4xl">
          One loop to get better
        </h2>
        <div className="relative mt-12">
          <svg aria-hidden className="absolute left-0 right-0 top-6 hidden h-2 w-full md:block" viewBox="0 0 1000 8" preserveAspectRatio="none">
            <line x1="60" y1="4" x2="940" y2="4" stroke="rgba(139,92,246,0.55)" strokeWidth="2" strokeLinecap="round" className="hp-draw" style={{ ["--hp-len" as string]: 880 }} />
          </svg>
          <ol className="relative grid gap-8 md:grid-cols-4">
            {STEPS.map((s, n) => (
              <li key={s.title} className="hp-reveal text-center md:text-left" style={{ ["--hp-i" as string]: n + 1 }}>
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-violet-400/40 bg-[#120b2c] text-violet-200 md:mx-0">
                  <s.icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">
                  <span className="mr-1.5 font-mono text-sm text-violet-300">{n + 1}</span>
                  {s.title}
                </h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/70">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </InView>
    </section>
  );
}
