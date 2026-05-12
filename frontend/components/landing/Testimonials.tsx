const TESTIMONIALS = [
  {
    quote: "Spotted a major leak in my flop c-bet sizing within the first session. Paid for itself in the first week of grinding.",
    name: "Mark V.",
    role: "Cash game regular",
    avatar: "M",
    rotate: "-rotate-[1.5deg]",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    quote: "The AI coaching actually explains things clearly. Not just 'this is wrong' but exactly why and how to fix it going forward.",
    name: "Sophie L.",
    role: "MTT tournament player",
    avatar: "S",
    rotate: "rotate-0 scale-[1.02]",
    gradient: "from-blue-500 to-indigo-600",
  },
  {
    quote: "Dashboard feels super clean and professional. Finally a poker tool that looks as good as it works.",
    name: "Tom B.",
    role: "Micro-stakes grinder",
    avatar: "T",
    rotate: "rotate-[1.5deg]",
    gradient: "from-emerald-500 to-teal-600",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-[#F5F6FA] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Header */}
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="mb-5 inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-500 shadow-sm">
            What players say
          </div>
          <h2 className="mb-4 text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Loved by players at every level
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed">
            From recreational players to serious grinders.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className={`${t.rotate} bg-white rounded-3xl p-7 transition-all duration-300 hover:scale-[1.02] hover:rotate-0 hover:-translate-y-1`}
              style={{
                boxShadow: "0 4px 28px rgba(15,23,42,0.08), 0 1px 4px rgba(15,23,42,0.04)",
                border: "1px solid rgba(15,23,42,0.06)",
              }}
            >
              {/* Quote mark */}
              <div
                className="mb-5 text-5xl leading-none font-black select-none"
                style={{
                  backgroundImage: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                &ldquo;
              </div>

              <p className="mb-7 text-[15px] text-slate-600 leading-relaxed">
                {t.quote}
              </p>

              <div className="flex items-center gap-3">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white shrink-0 bg-gradient-to-br ${t.gradient}`}
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                  <p className="text-[12px] text-slate-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
