/**
 * Dealer button ("D") marker — moved verbatim out of
 * `components/learn/visuals/PreflopTable.tsx`, where it was previously
 * private, so it's a shared table primitive available to any future table
 * renderer instead of being re-implemented per screen.
 */
export function DealerMarker({ style }: { style: React.CSSProperties }) {
  return (
    <div className="absolute z-20" style={style}>
      <span
        aria-label="Dealer button"
        title="Dealer"
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[8px] font-black text-neutral-800 shadow-sm"
      >
        D
      </span>
    </div>
  )
}
