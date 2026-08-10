/**
 * Dealer button ("D") marker — moved verbatim out of
 * `components/learn/visuals/PreflopTable.tsx`, where it was previously
 * private, so it's a shared table primitive available to any future table
 * renderer instead of being re-implemented per screen.
 */
const BUTTON_CLASS =
  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[8px] font-black text-neutral-800 shadow-sm'

export function DealerMarker({ style }: { style: React.CSSProperties }) {
  return (
    <div data-tt="dealer" className="absolute z-20" style={style}>
      <span aria-label="Dealer button" title="Dealer" className={BUTTON_CLASS}>
        D
      </span>
    </div>
  )
}

/**
 * The same button, laid out INLINE beside its seat's position label instead of
 * being positioned on the table's geometry.
 *
 * Mobile uses this. An absolutely-placed button has to be offset from the seat
 * somehow, and on a phone every direction is already taken: radially outward is
 * the container edge, radially inward is the chip, and tangentially is where
 * the seat's own stack row sits for the seats on the left and right. Letting
 * normal flow place it next to the position text removes the whole class of
 * collisions rather than trading one for another — and "BTN Ⓓ" reads as one
 * fact about one player, which is what it is.
 */
export function InlineDealerMarker() {
  return (
    <span
      data-tt="dealer"
      aria-label="Dealer button"
      title="Dealer"
      className={`${BUTTON_CLASS} ml-1 inline-flex align-middle`}
    >
      D
    </span>
  )
}
