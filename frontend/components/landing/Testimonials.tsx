const TESTIMONIALS = [
  {
    quote: "Spotted a major leak in my flop c-bet sizing within the first session. Paid for itself in the first week of grinding.",
    name: "Mark V.",
    role: "Cash game regular",
    avatar: "M",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    quote: "The AI coaching actually explains things clearly. Not just 'this is wrong' but exactly why and how to fix it going forward.",
    name: "Sophie L.",
    role: "MTT tournament player",
    avatar: "S",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    quote: "Dashboard feels super clean and professional. Finally a poker tool that looks as good as it works.",
    name: "Tom B.",
    role: "Micro-stakes grinder",
    avatar: "T",
    gradient: "from-emerald-500 to-teal-600",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="relative bg-background py-24 sm:py-32 overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-violet-600/5 blur-[110px]"
      />

      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-muted-foreground">
            What players say
          </div>
          <h2 className="mb-4 text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
            Loved by players{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-blue-400">
              at every level
            </span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            From recreational players to serious grinders.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-border/50 bg-card/60 p-7 hover:border-border/80 hover:bg-card/80 hover:-translate-y-1 transition-all duration-300"
            >
              {/* Quote mark */}
              <div className="mb-5 text-4xl font-black select-none leading-none text-transparent bg-clip-text bg-gradient-to-br from-violet-400/50 to-blue-400/30">
                &ldquo;
              </div>

              <p className="mb-7 text-[15px] text-muted-foreground leading-relaxed">
                {t.quote}
              </p>

              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0 bg-gradient-to-br ${t.gradient}`}>
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="text-[12px] text-muted-foreground/55">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
