import { PRO_PRICE_LABEL } from "@/lib/billing/entitlements";
import { BRAND, EMAIL } from "./strings";
import { accuracyPct, firstName, type Candidate, type EmailTemplate, type Template } from "./plan";
import { spotInfo, teaserSpot } from "./spots";

/**
 * Lifecycle email rendering: subject, HTML and plain text for day1/day3/day7
 * and trial_ending.
 *
 * Email-client HTML: tables and inline styles only (Gmail strips <style> in
 * some views), one 560px column that shrinks on phones, dark colours that
 * match the site (#0B0E1A background, #7C5CFF violet). The founder email
 * (day7) is deliberately plain — it should read like a personal note.
 */

export interface RenderedEmail {
  template: EmailTemplate;
  subject: string;
  preheader: string;
  html: string;
  text: string;
  /** Teaser / weakest-spot facts, for the dry-run report. */
  summary: string;
}

export interface RenderContext {
  siteUrl: string;
  unsubscribeUrl: string;
  /** Seed for the day-1 teaser (user id + date), so a retried run sends the same spot. */
  seed: string;
}

const C = {
  bg: "#0B0E1A",
  card: "#141A2E",
  border: "#262D48",
  text: "#E8EAF2",
  muted: "#9AA1B9",
  faint: "#6B7290",
  violet: "#7C5CFF",
  violetSoft: "#B9A8FF",
};

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function trainerUrl(siteUrl: string, campaign: Template, query = ""): string {
  const utm = `utm_source=email&utm_medium=lifecycle&utm_campaign=${campaign}`;
  return `${siteUrl}/preflop-trainer${query ? `${query}&${utm}` : `?${utm}`}`;
}

const p = (html: string, style = "") =>
  `<p style="margin:0 0 16px;font:16px/1.55 ${FONT};color:${C.text};${style}">${html}</p>`;

function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px"><tr><td style="border-radius:12px;background:${C.violet}">
<a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;font:600 16px/1 ${FONT};color:#ffffff;text-decoration:none;border-radius:12px">${escapeHtml(label)} &rarr;</a>
</td></tr></table>`;
}

function box(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 20px;border:1px solid ${C.border};border-radius:14px;background:${C.card}"><tr><td style="padding:18px 20px">${inner}</td></tr></table>`;
}

function layout(preheader: string, body: string, ctx: RenderContext): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><meta name="supported-color-schemes" content="dark light"><title>${escapeHtml(BRAND)}</title></head>
<body style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bg}">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg}"><tr><td align="center" style="padding:28px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px;font:800 18px/1 ${FONT};color:${C.text};letter-spacing:-0.2px"><span style="color:${C.violet}">&#9824;</span> ${escapeHtml(BRAND)}</td></tr>
<tr><td style="padding:0 4px">${body}</td></tr>
<tr><td style="padding:24px 4px 0;border-top:1px solid ${C.border};font:13px/1.6 ${FONT};color:${C.faint}">
${escapeHtml(EMAIL.footerWhy)}<br>
<a href="${escapeHtml(ctx.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline">${EMAIL.unsubscribe}</a> &middot;
<a href="${escapeHtml(`${ctx.siteUrl}/settings`)}" style="color:${C.muted};text-decoration:underline">${EMAIL.settings}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function textFooter(ctx: RenderContext): string {
  return `\n\n--\n${EMAIL.footerWhy}\n${EMAIL.unsubscribe}: ${ctx.unsubscribeUrl}\n`;
}

// ── Day 1 ───────────────────────────────────────────────────────────────────

function day1(c: Candidate, ctx: RenderContext): RenderedEmail {
  const name = firstName(c.name);
  const spot = teaserSpot(ctx.seed);
  const url = trainerUrl(ctx.siteUrl, "day1");
  const subject = EMAIL.day1.subject(c.streak);
  const preheader = EMAIL.day1.preheader(spot.oneLine);
  const html = layout(
    preheader,
    p(escapeHtml(EMAIL.greeting(name))) +
      p(escapeHtml(EMAIL.day1.intro)) +
      box(
        `<div style="font:700 22px/1.3 ${FONT};color:${C.text}">${escapeHtml(spot.headline)}</div>` +
          `<div style="margin-top:6px;font:16px/1.5 ${FONT};color:${C.violetSoft}">${escapeHtml(spot.question)}</div>`,
      ) +
      button(url, EMAIL.day1.cta) +
      p(escapeHtml(EMAIL.streak(c.streak)), `color:${C.muted};font-size:15px`) +
      p(escapeHtml(EMAIL.day1.after), `color:${C.muted};font-size:15px`),
    ctx,
  );
  const text =
    `${EMAIL.greeting(name)}\n\n${EMAIL.day1.intro}\n\n  ${spot.headline}\n  ${spot.question}\n\n` +
    `${EMAIL.day1.cta}: ${url}\n\n${EMAIL.streak(c.streak)}\n${EMAIL.day1.after}` +
    textFooter(ctx);
  return { template: "day1", subject, preheader, html, text, summary: `teaser "${spot.oneLine}", streak ${c.streak}` };
}

// ── Day 3 ───────────────────────────────────────────────────────────────────

function day3(c: Candidate, ctx: RenderContext): RenderedEmail {
  const name = firstName(c.name);
  const acc = accuracyPct(c);
  const weak = c.weakestRef && c.weakestWrong !== null && c.weakestHands !== null ? spotInfo(c.weakestRef) : null;
  const url = trainerUrl(ctx.siteUrl, "day3", weak?.query);
  const subject = EMAIL.day3.subject(c.handsTotal, weak?.label ?? null);
  const preheader = EMAIL.day3.preheader(c.handsTotal, acc);
  const cta = EMAIL.day3.cta(Boolean(weak));
  const weakLine = weak ? EMAIL.day3.weakest(weak.label, c.weakestWrong!, c.weakestHands!) : c.handsTotal > 0 ? EMAIL.day3.noWeakest : null;

  const stat = (label: string, value: string) =>
    `<td width="50%" style="padding:4px 0;vertical-align:top"><div style="font:12px/1.4 ${FONT};color:${C.muted};text-transform:uppercase;letter-spacing:0.6px">${escapeHtml(label)}</div><div style="font:700 28px/1.2 ${FONT};color:${C.text}">${escapeHtml(value)}</div></td>`;

  const stats =
    c.handsTotal === 0
      ? ""
      : box(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${stat(EMAIL.day3.handsLabel, c.handsTotal.toLocaleString("en-US"))}${acc !== null ? stat(EMAIL.day3.accuracyLabel, `${acc}%`) : ""}</tr></table>` +
            (acc !== null ? `<div style="margin-top:8px;font:13px/1.5 ${FONT};color:${C.faint}">${escapeHtml(EMAIL.day3.accuracyNote)}</div>` : "") +
            (weakLine ? `<div style="margin-top:12px;font:15px/1.5 ${FONT};color:${C.violetSoft}">${escapeHtml(weakLine)}</div>` : ""),
        );

  const html = layout(
    preheader,
    p(escapeHtml(EMAIL.greeting(name))) +
      p(escapeHtml(c.handsTotal === 0 ? EMAIL.day3.introNone : EMAIL.day3.intro)) +
      stats +
      button(url, cta) +
      p(escapeHtml(EMAIL.streak(c.streak)), `color:${C.muted};font-size:15px`),
    ctx,
  );
  const text =
    `${EMAIL.greeting(name)}\n\n${c.handsTotal === 0 ? EMAIL.day3.introNone : EMAIL.day3.intro}\n\n` +
    (c.handsTotal > 0
      ? `  ${EMAIL.day3.handsLabel}: ${c.handsTotal.toLocaleString("en-US")}\n` +
        (acc !== null ? `  ${EMAIL.day3.accuracyLabel}: ${acc}% (${EMAIL.day3.accuracyNote})\n` : "") +
        (weakLine ? `  ${weakLine}\n` : "") +
        "\n"
      : "") +
    `${cta}: ${url}\n\n${EMAIL.streak(c.streak)}` +
    textFooter(ctx);
  const summary = `${c.handsTotal} hands (${c.handsSource}), accuracy ${acc ?? "n/a"}${acc !== null ? "%" : ""}, weakest ${weak ? `${weak.label} ${c.weakestWrong}/${c.weakestHands} wrong` : "none"}, streak ${c.streak}`;
  return { template: "day3", subject, preheader, html, text, summary };
}

// ── Day 7 ───────────────────────────────────────────────────────────────────

function day7(c: Candidate, ctx: RenderContext): RenderedEmail {
  const lines = EMAIL.day7.lines(firstName(c.name), c.handsTotal);
  const plain = (s: string) => `<p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:${C.text}">${escapeHtml(s)}</p>`;
  const html = layout(
    EMAIL.day7.preheader,
    lines.map(plain).join("") +
      plain(EMAIL.day7.signoff) +
      `<p style="margin:18px 0 20px;font:14px/1.6 ${FONT};color:${C.muted}">P.S. ${escapeHtml(EMAIL.day7.ps)}</p>`,
    ctx,
  );
  const text = `${lines.join("\n\n")}\n\n${EMAIL.day7.signoff}\n\nP.S. ${EMAIL.day7.ps}` + textFooter(ctx);
  return { template: "day7", subject: EMAIL.day7.subject, preheader: EMAIL.day7.preheader, html, text, summary: `founder note, ${c.handsTotal} hands` };
}

// ── Trial ending ────────────────────────────────────────────────────────────

/** "Thursday, October 22" in the user's own time zone. */
function endDate(iso: string, timezone: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: "long", month: "long", day: "numeric" };
  try {
    return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: timezone });
  } catch {
    return new Date(iso).toLocaleDateString("en-US", { ...opts, timeZone: "Europe/Amsterdam" });
  }
}

function trialEnding(c: Candidate, ctx: RenderContext, now: number): RenderedEmail {
  const T = EMAIL.trialEnding;
  const endsAt = c.trialEndsAt ?? new Date(now + 2 * 86_400_000).toISOString();
  const when = T.when(Math.round((new Date(endsAt).getTime() - now) / 86_400_000));
  // Straight into Stripe Checkout for Pro (app/checkout): signs in first if needed.
  const url = `${ctx.siteUrl}/checkout?source=trial_ending&utm_source=email&utm_medium=lifecycle&utm_campaign=trial_ending`;
  const subject = T.subject(when);
  const preheader = T.preheader(PRO_PRICE_LABEL);
  const intro = T.intro(when, endDate(endsAt, c.timezone));
  const perks = T.perks
    .map((perk) => `<div style="padding:3px 0;font:15px/1.5 ${FONT};color:${C.text}"><span style="color:${C.violetSoft}">&#10003;</span>&nbsp; ${escapeHtml(perk)}</div>`)
    .join("");
  const html = layout(
    preheader,
    p(escapeHtml(EMAIL.greeting(firstName(c.name)))) +
      p(escapeHtml(intro)) +
      box(perks) +
      button(url, T.cta(PRO_PRICE_LABEL)) +
      p(escapeHtml(T.fine), `color:${C.faint};font-size:13px;margin-top:-8px`) +
      p(escapeHtml(T.after), `color:${C.muted};font-size:15px`),
    ctx,
  );
  const text =
    `${EMAIL.greeting(firstName(c.name))}\n\n${intro}\n\n${T.perks.map((x) => `  - ${x}`).join("\n")}\n\n` +
    `${T.cta(PRO_PRICE_LABEL)}: ${url}\n${T.fine}\n\n${T.after}` +
    textFooter(ctx);
  return { template: "trial_ending", subject, preheader, html, text, summary: `trial ends ${when} (${endsAt})` };
}

// ── Promo: 50% off Pro for 3 months ─────────────────────────────────────────

export interface PromoInput {
  name: string | null;
  timezone: string;
  /** When the Stripe promotion code stops working. */
  expiresAt: string;
  promoCode: string;
}

/** "Saturday, October 31 at 18:00 GMT+1" in the user's own time zone. */
export function promoDeadline(iso: string, timezone: string): string {
  const fmt = (timeZone: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone });
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone, timeZoneName: "short" });
    return `${date} at ${time}`;
  };
  try {
    return fmt(timezone);
  } catch {
    return fmt("Europe/Amsterdam");
  }
}

/** Personal, plain-looking note from the founder with one button (like day7). */
export function renderPromo3m50(input: PromoInput, ctx: RenderContext): RenderedEmail {
  const T = EMAIL.promo3m50;
  const deadline = promoDeadline(input.expiresAt, input.timezone);
  // Straight into Stripe Checkout with the code applied (app/checkout).
  const url =
    `${ctx.siteUrl}/checkout?source=promo_3m_50&promo=${encodeURIComponent(input.promoCode)}` +
    "&utm_source=email&utm_medium=campaign&utm_campaign=promo_3m_50";
  const lines = T.lines(firstName(input.name));
  const plain = (s: string, style = "") => `<p style="margin:0 0 14px;font:16px/1.6 ${FONT};color:${C.text};${style}">${escapeHtml(s)}</p>`;
  const perks = T.perks.map((x) => `<li style="margin:0 0 6px">${escapeHtml(x)}</li>`).join("");
  const html = layout(
    T.preheader(deadline),
    lines.map((l) => plain(l)).join("") +
      plain(T.perksIntro, "margin-bottom:6px") +
      `<ul style="margin:0 0 18px;padding-left:22px;font:16px/1.6 ${FONT};color:${C.text}">${perks}</ul>` +
      button(url, T.cta) +
      plain(T.deadline(deadline), `color:${C.muted};font-size:15px`) +
      p(escapeHtml(T.fine), `color:${C.faint};font-size:13px;margin-top:-6px`) +
      plain(T.signoff) +
      `<p style="margin:18px 0 20px;font:14px/1.6 ${FONT};color:${C.muted}">P.S. ${escapeHtml(T.ps)}</p>`,
    ctx,
  );
  const text =
    `${lines.join("\n\n")}\n\n${T.perksIntro}\n${T.perks.map((x) => `  - ${x}`).join("\n")}\n\n` +
    `${T.cta}: ${url}\n\n${T.deadline(deadline)}\n${T.fine}\n\n${T.signoff}\n\nP.S. ${T.ps}` +
    textFooter(ctx);
  return { template: "promo_3m_50", subject: T.subject, preheader: T.preheader(deadline), html, text, summary: `promo ${input.promoCode}, ends ${deadline}` };
}

export function renderEmail(template: Template, c: Candidate, ctx: RenderContext, now = Date.now()): RenderedEmail {
  if (template === "trial_ending") return trialEnding(c, ctx, now);
  if (template === "day1") return day1(c, ctx);
  if (template === "day3") return day3(c, ctx);
  return day7(c, ctx);
}

