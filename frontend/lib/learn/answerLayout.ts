/**
 * How a set of answer options is laid out, per option count and breakpoint.
 *
 * Three or more choices side by side on a phone gives each answer roughly a
 * third of ~295px of card width. "QJs has excellent playability across many
 * board textures" then wraps to five or six lines in a column narrower than
 * the words in it, and every option in the row inherits the height of the
 * longest one — a tall, ragged, hard-to-read block of text.
 *
 * So from three options up, phones get one option per row: full width, one or
 * two lines instead of six, a consistent minimum height, and a target that is
 * comfortable to hit with a thumb. Two options (Fold/Call, Yes/No,
 * Easier/Harder) genuinely do fit side by side and are left alone — stacking
 * them would only add scrolling.
 *
 * From `sm:` (640px) up, every layout is exactly what it was before.
 *
 * Both helpers return complete literal class strings rather than building them
 * by interpolation: Tailwind's scanner reads source text, so a class assembled
 * as `sm:grid-cols-${n}` is never generated.
 */

/** At this many options a row stops fitting comfortably on a phone. */
export const STACK_FROM = 3

/** Desktop column counts, kept as literals so the JIT emits them. */
const DESKTOP_COLS: Record<number, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
  5: 'sm:grid-cols-5',
}

/**
 * Grid classes for an answer row.
 *
 * @param count        how many options are being rendered
 * @param desktopCols  columns to keep from `sm:` up — pass whatever the layout
 *                     already used, so the desktop rendering does not move
 */
export function answerGridClass(count: number, desktopCols = 2): string {
  if (count < STACK_FROM) return 'grid-cols-2'
  const desktop = DESKTOP_COLS[desktopCols] ?? DESKTOP_COLS[2]
  return `grid-cols-1 ${desktop}`
}

/**
 * Extra button classes for an option that stacks on mobile: a consistent
 * 56px minimum height with the label centred in it, reverting to the original
 * box from `sm:` up. Returns undefined below the stacking threshold so a
 * two-option row is untouched.
 *
 * `content` describes what is inside the button, because the two cases need
 * different flex axes:
 *   'label'  — a single run of text (the common case)
 *   'block'  — stacked children, e.g. a title over a sub-label, which must
 *              keep flowing vertically rather than becoming flex columns
 */
export function stackedAnswerClass(
  count: number,
  content: 'label' | 'block' = 'label',
): string | undefined {
  if (count < STACK_FROM) return undefined
  return content === 'label'
    ? 'flex min-h-[3.5rem] items-center sm:block sm:min-h-0'
    : 'flex min-h-[3.5rem] flex-col justify-center sm:block sm:min-h-0'
}
