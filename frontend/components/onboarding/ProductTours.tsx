"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Compass, ImageIcon, X } from "lucide-react";
import { CoachMarks, type TourStep } from "@/components/tour/CoachMarks";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboarding } from "@/hooks/useOnboarding";
import { HANDS_IMPORT_PATH } from "@/lib/handHistory/feature";
import { DEFAULT_MIN_POT_BB } from "@/lib/handHistory/filters";
import { otherTour, showTrainerTourNudge, TOUR_META, tourHref, type Tour } from "@/lib/onboarding/state";

/**
 * The product tours, mounted once in the root layout.
 *
 *   ?tour=preflop on /preflop-trainer  — coach marks over the real trainer
 *   ?tour=hands   on /hands/import, then /hands/example (&step=n)
 *
 * After a tour: "Want a quick tour of the other one too?". Trainer-prompt
 * signups get an optional "Want a 1-minute tour?" card on the trainer.
 */
export function ProductTours() {
  return (
    <Suspense fallback={null}>
      <Tours />
    </Suspense>
  );
}

const EXAMPLE_PATH = "/hands/example";

function Tours() {
  const params = useSearchParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { user } = useAuth();
  const ob = useOnboarding();
  const [offer, setOffer] = useState<Tour | null>(null);

  const raw = params.get("tour");
  const tour: Tour | null = raw === "preflop" || raw === "hands" ? raw : null;

  /** The current URL without the tour parameters (keeps the trainer's filters). */
  const withoutTour = useCallback(() => {
    const p = new URLSearchParams(params.toString());
    p.delete("tour");
    p.delete("step");
    const q = p.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [params, pathname]);

  const close = useCallback(() => router.replace(withoutTour(), { scroll: false }), [router, withoutTour]);

  const skip = useCallback(() => {
    void ob.skipTour();
    close();
  }, [ob, close]);

  /** Tour finished: mark it, close it, offer the other one if it is still to do. */
  const finish = useCallback(
    (t: Tour, then?: string) => {
      const other = otherTour(ob.row, t);
      void ob.completeTour(t);
      if (then) router.push(then);
      else close();
      if (other) setOffer(other);
    },
    [ob, close, router],
  );

  if (!user) return null;

  if (tour === "preflop" && pathname === TOUR_META.preflop.path) {
    return <PreflopTour onSkip={skip} onFinish={() => finish("preflop")} />;
  }
  if (tour === "hands" && pathname.startsWith("/hands")) {
    return (
      <HandsTour
        index={Number(params.get("step") ?? 0) || 0}
        pathname={pathname}
        go={(i, path) => {
          const url = `${path}?tour=hands&step=${i}`;
          if (path === pathname) router.replace(url, { scroll: false });
          else router.push(url);
        }}
        onSkip={skip}
        onFinish={(then) => finish("hands", then)}
      />
    );
  }

  if (offer) {
    return (
      <OfferCard
        tour={offer}
        onYes={() => {
          setOffer(null);
          router.push(tourHref(offer));
        }}
        onLater={() => setOffer(null)}
      />
    );
  }

  if (!tour && pathname === TOUR_META.preflop.path && ob.loaded && showTrainerTourNudge(ob.row, ob.signupSource)) {
    return <TrainerNudge onYes={() => router.replace(`${pathname}?tour=preflop`, { scroll: false })} onNo={() => void ob.skipTour()} />;
  }
  return null;
}

// ── Preflop Trainer ─────────────────────────────────────────────────────────

const has = (sel: string) => () => Boolean(document.querySelector(sel));
const gone = (sel: string) => () => !document.querySelector(sel);

function PreflopTour({ onSkip, onFinish }: { onSkip: () => void; onFinish: () => void }) {
  const [index, setIndex] = useState(0);
  const steps: TourStep[] = [
    {
      id: "spot",
      target: '[data-tour="trainer-spot"]',
      title: "This is a spot",
      body: "Your position at the table, the stack size in big blinds and your two cards. Every hand is a real tournament situation.",
    },
    {
      id: "play",
      target: '[data-tour="trainer-actions"]',
      title: "Make your play",
      body: "Fold, call, raise or all-in: pick what you would do here. This hand counts like any other.",
      interactive: true,
      advanceWhen: has('[data-tour="trainer-result"]'),
      waitingHint: "Pick an action to continue",
    },
    {
      id: "why",
      target: '[data-tour="trainer-result"]',
      title: "See why",
      body: "Your answer is checked against the chart for this spot, with your hand highlighted. Violet raise, green call, red all-in, blue limp, grey fold.",
      interactive: true,
      noBack: true,
      advanceWhen: gone('[data-tour="trainer-result"]'),
      waitingHint: "Press Next hand to continue",
    },
    {
      id: "leaks",
      target: '[data-tour="trainer-stats"]',
      title: "Track your leaks",
      body: "Score, streak and your record update after every hand. Free accounts get 50 hands per day; the counter under the table shows how many are left.",
      noBack: true,
    },
    {
      id: "done",
      target: null,
      final: true,
      title: "You're ready.",
      body: "Play 5 more hands to warm up.",
      actions: (
        <button
          type="button"
          data-primary
          onClick={onFinish}
          className="w-full rounded-lg bg-[#7C5CFF] sm:w-auto px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A]"
        >
          Keep drilling
        </button>
      ),
    },
  ];
  return <CoachMarks steps={steps} index={index} onIndexChange={setIndex} onSkip={onSkip} onFinish={onFinish} label="Preflop Trainer tour" />;
}

// ── Hand Review ─────────────────────────────────────────────────────────────

/**
 * PokerCraft export steps. `image` is a path under /public/onboarding once
 * the real screenshots are in; until then a labelled placeholder is shown.
 */
const POKERCRAFT_STEPS: { title: string; text: string; image: string | null }[] = [
  { title: "Open PokerCraft", text: "In the GGPoker client, open PokerCraft.", image: null },
  { title: "Pick your tournament", text: "Go to your tournament results and select the tournament you want to review.", image: null },
  { title: "Download the hand histories", text: "Download them: you get a .zip file with one .txt file per tournament.", image: null },
];

function PokerCraftSteps() {
  return (
    <ol className="mt-3 grid gap-3 sm:grid-cols-3">
      {POKERCRAFT_STEPS.map((s, i) => (
        <li key={s.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {s.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image} alt={`PokerCraft: ${s.title}`} className="aspect-video w-full rounded-lg object-cover" />
          ) : (
            <div className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-white/20 bg-white/[0.02] text-[11px] text-white/45">
              <ImageIcon aria-hidden="true" className="h-4 w-4" />
              Screenshot {i + 1} coming soon
            </div>
          )}
          <p className="mt-2 text-xs font-semibold text-white">
            {i + 1}. {s.title}
          </p>
          <p className="mt-0.5 text-xs text-white/65">{s.text}</p>
        </li>
      ))}
    </ol>
  );
}

function HandsTour({
  index,
  pathname,
  go,
  onSkip,
  onFinish,
}: {
  index: number;
  pathname: string;
  go: (i: number, path: string) => void;
  onSkip: () => void;
  onFinish: (then?: string) => void;
}) {
  const steps: (TourStep & { path: string })[] = [
    {
      id: "export",
      path: HANDS_IMPORT_PATH,
      target: null,
      wide: true,
      title: "Export from PokerCraft",
      body: <PokerCraftSteps />,
    },
    {
      id: "upload",
      path: HANDS_IMPORT_PATH,
      target: '[data-tour="hands-upload"]',
      title: "Upload your tournament",
      body: "Drop the .zip here or choose the files. Everything is read in your browser, and uploading the same export again skips the duplicates.",
    },
    {
      id: "matters",
      path: EXAMPLE_PATH,
      target: '[data-tour="example-list"]',
      title: "Only the hands that matter",
      body: `We hide hands you folded and pots under ${DEFAULT_MIN_POT_BB} bb, so you start with the hands where chips moved. This is an example tournament: try anything, nothing is saved.`,
    },
    {
      id: "leaks",
      path: EXAMPLE_PATH,
      target: '[data-tour="example-check"]',
      title: "Spot your leaks",
      body: "Every first-in decision is checked against the trainer's range for your position and stack. Too loose: you played a hand the range folds. Too tight: you folded a hand it plays. The chart shows the range with your hand marked.",
    },
    {
      id: "study",
      path: EXAMPLE_PATH,
      target: '[data-tour="example-study"]',
      title: "Star and note",
      body: "Star the hands you want to study and write down what you'd do differently. Starred and noted hands get their own filters.",
      interactive: true,
    },
    {
      id: "done",
      path: EXAMPLE_PATH,
      target: null,
      final: true,
      title: "That's Hand Review.",
      body: "Upload a tournament of your own, or look around the example first.",
      actions: (
        <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={() => onFinish()}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium sm:w-auto text-white/75 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF]"
          >
            Explore the example first
          </button>
          <button
            type="button"
            data-primary
            onClick={() => onFinish(HANDS_IMPORT_PATH)}
            className="w-full rounded-lg bg-[#7C5CFF] sm:w-auto px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#6B4BEE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C5CFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0E1A]"
          >
            Upload your own tournament
          </button>
        </div>
      ),
    },
  ];
  const i = Math.min(Math.max(index, 0), steps.length - 1);
  const step = steps[i];

  // A step lives on its own page: go there first, then show the coach mark.
  useEffect(() => {
    if (pathname !== step.path) go(i, step.path);
  }, [pathname, step.path, i, go]);
  if (pathname !== step.path) return null;

  return (
    <CoachMarks
      steps={steps}
      index={i}
      onIndexChange={(n) => go(n, steps[n].path)}
      onSkip={onSkip}
      onFinish={() => onFinish()}
      label="Hand Review tour"
    />
  );
}

// ── Offer, nudge ────────────────────────────────────────────────────────────

function FloatingCard({ children, onClose, label }: { children: React.ReactNode; onClose: () => void; label: string }) {
  return (
    <div
      role="dialog"
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-[60] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-4 sm:max-w-sm sm:px-0"
    >
      <div className="relative rounded-2xl border border-[#7C5CFF]/40 bg-[#0B0E1A] p-4 text-white shadow-2xl shadow-black/60 animate-fade-in">
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:bg-white/5 hover:text-white"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function OfferCard({ tour, onYes, onLater }: { tour: Tour; onYes: () => void; onLater: () => void }) {
  const meta = TOUR_META[tour];
  return (
    <FloatingCard onClose={onLater} label={`Tour of ${meta.title}`}>
      <p className="flex items-center gap-1.5 pr-8 font-semibold">
        <Compass aria-hidden="true" className="h-4 w-4 text-[#B9A8FF]" />
        Nice! Want a quick tour of {meta.title} too?
      </p>
      <p className="mt-1 text-sm text-white/65">About {meta.minutes} min.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onYes} className="flex-1 rounded-lg bg-[#7C5CFF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6B4BEE]">
          Show me
        </button>
        <button type="button" onClick={onLater} className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/[0.06]">
          Maybe later
        </button>
      </div>
    </FloatingCard>
  );
}

function TrainerNudge({ onYes, onNo }: { onYes: () => void; onNo: () => void }) {
  return (
    <FloatingCard onClose={onNo} label="Preflop Trainer tour">
      <p className="flex items-center gap-1.5 pr-8 font-semibold">
        <Compass aria-hidden="true" className="h-4 w-4 text-[#B9A8FF]" />
        Want a 1-minute tour?
      </p>
      <p className="mt-1 text-sm text-white/65">See how spots, feedback and your stats work.</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onYes} className="flex-1 rounded-lg bg-[#7C5CFF] px-3 py-2 text-sm font-semibold text-white hover:bg-[#6B4BEE]">
          Show me
        </button>
        <button type="button" onClick={onNo} className="flex-1 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/[0.06]">
          No thanks
        </button>
      </div>
    </FloatingCard>
  );
}
