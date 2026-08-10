/**
 * Dealer button ("D") marker — moved verbatim out of
 * `components/learn/visuals/PreflopTable.tsx`, where it was previously
 * private, so it's a shared table primitive available to any future table
 * renderer instead of being re-implemented per screen.
 */
const BUTTON_CLASS =
  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[8px] font-black text-neutral-800 shadow-sm'

const COMPACT_BUTTON_CLASS =
  'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/90 text-[7px] font-black text-neutral-800 shadow-sm'

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
/**
 * The dealer button for a mobile seat pod: out of flow, horizontally centred on
 * the position label, and stacked on whichever vertical side the pod's stack row
 * is NOT using.
 *
 * Both of those are deliberate. In flow the button widened the label box, and
 * since that box is centred on the seat anchor with `-translate-x-1/2`, the
 * extra width shoved the position text off-centre by half a button — the one
 * seat at the table whose label did not line up with its own stack row. Moving
 * it out of flow fixed the centring but pushed the button sideways into the
 * NEXT seat's stack text instead. Sideways is simply the wrong axis here: the
 * seats are spaced around the table, so horizontal room between neighbours is
 * the scarce kind, while the pod only ever grows one way vertically and leaves
 * the other side free.
 */
export function InlineDealerMarker({ below = false }: { below?: boolean }) {
  return (
    <span
      data-tt="dealer"
      aria-label="Dealer button"
      title="Dealer"
      // Compact (14px, not the desktop 16px) and hugging the label: the free
      // vertical band between a seat's label and its own chip is only a few
      // pixels wider than the button itself once that chip carries an action
      // verb, so the button is sized to the gap rather than the gap being
      // wished larger.
      className={`${COMPACT_BUTTON_CLASS} absolute left-1/2 -translate-x-1/2 ${
        below ? 'top-full mt-0.5' : 'bottom-full mb-0.5'
      }`}
    >
      D
    </span>
  )
}
