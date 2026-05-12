const STATS = [
  { value: "50K+", label: "Hands analyzed",        gradient: "from-violet-400 to-blue-400" },
  { value: "< 5s", label: "Average analysis time",  gradient: "from-blue-400 to-cyan-400" },
  { value: "GTO",  label: "Solver-inspired rules",  gradient: "from-violet-400 to-purple-400" },
  { value: "Free", label: "To get started",          gradient: "from-blue-400 to-violet-400" },
];

export function Stats() {
  return (
    <section className="relative py-20 sm:py-24 overflow-hidden bg-secondary/20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 70% at 50% 100%, rgba(124,92,255,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className={`mb-1.5 text-4xl sm:text-5xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r ${s.gradient}`}>
                {s.value}
              </p>
              <p className="text-[13px] text-muted-foreground/60 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
