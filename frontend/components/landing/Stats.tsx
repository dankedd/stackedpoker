const STATS = [
  { value: "50K+", label: "Hands analyzed" },
  { value: "< 5s", label: "Average analysis time" },
  { value: "GTO", label: "Solver-inspired rules" },
  { value: "Free", label: "To get started" },
];

export function Stats() {
  return (
    <section className="relative py-20 sm:py-24 overflow-hidden bg-[#0F172A]">
      {/* Subtle glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 100%, rgba(79,70,229,0.07) 0%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="mb-1 text-4xl sm:text-5xl font-black tracking-tight"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, #FFFFFF 0%, #94A3B8 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                {s.value}
              </p>
              <p className="text-[13px] text-slate-500 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
