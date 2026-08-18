---
version: alpha
name: StackedPoker — Understand (video / frame layer)
description: >
  The design spec for the "Understand" commercial. Unlike the two previous films,
  this one does NOT inherit the site-capture palette — the brief mandates an
  explicit brand set: violet #7C5CFF, blue #5EA8FF, their 135° gradient, a
  #0D1526 midnight ground and a #080D1A deep field. Geist Sans throughout,
  Geist Mono for small technical labels. Midnight frosted glass, one dominant
  light source, cinematic depth.
unit: the frame — 1920×1080
principle: one light source · one hand · one idea per scene · restraint reads as expensive

colors:
  bg: "#0D1526"
  bg-deep: "#080D1A"
  primary: "#7C5CFF"
  secondary: "#5EA8FF"
  gradient: "linear-gradient(135deg, #7C5CFF 0%, #5EA8FF 100%)"
  text: "#FFFFFF"
  text-soft: "#BACDF7"
  text-muted: "rgba(186,205,247,0.62)"
  text-faint: "rgba(186,205,247,0.38)"
  border: "rgba(186,205,247,0.10)"
  border-lit: "rgba(186,205,247,0.18)"
  glass: "rgba(14,24,44,0.62)"
  glass-raised: "rgba(20,32,56,0.70)"
  inset-highlight: "rgba(186,205,247,0.14)"

radii:
  card: "20px"
  panel: "16px"
  chip: "10px"
  pill: "100px"
  cell: "5px"
  icon-square: "22px"

typography:
  display:  { fontFamily: "Geist", weight: 900, tracking: "-0.03em", color: "text" }
  headline: { fontFamily: "Geist", weight: 800, tracking: "-0.025em", color: "text" }
  title:    { fontFamily: "Geist", weight: 700, tracking: "-0.02em", color: "text" }
  body:     { fontFamily: "Geist", weight: 400, lineHeight: 1.65, color: "text-muted" }
  label:    { fontFamily: "Geist Mono", weight: 500, tracking: "0.18em", upper: true, color: "text-faint" }
  rank:     { fontFamily: "Geist", weight: 700, tracking: "-0.02em" }

spacing:
  gutter: "120px"
  card-pad: "40px"
  stack: "28px"

components:
  glass-card:
    background: "{colors.glass}"
    border: "1px solid {colors.border}"
    rounded: "{radii.card}"
    insetTop: "inset 0 1px 0 {colors.inset-highlight}"
    shadow: "0 40px 120px rgba(0,0,0,0.45)"
    backdrop: "blur(18px)"
    description: "The midnight frosted-glass surface. Dark translucent fill, ONE cool hairline, an inset top highlight, a soft wide shadow. Never opaque, never neon-edged."
  poker-card:
    size: "132×186 (canonical); scaled uniformly when smaller"
    background: "linear-gradient(168deg, #FFFFFF 0%, #E8EEFB 100%)"
    rounded: "12px"
    ink: "#0D1526"
    description: "A♠5♠ only. Rank above a centred spade pip. No corner indices, no multi-pip layout, no border."
  gradient-text:
    background: "{colors.gradient}"
    clip: "text"
    description: "Reserved for exactly four words in the whole film: RANGES, Poker, By Playing. and nothing else."
  cta:
    background: "{colors.gradient}"
    textColor: "#FFFFFF"
    rounded: "{radii.pill}"
    description: "The one solid element in the film. No hover state, no pulse, no shine sweep."
  spotlight:
    description: "ONE soft violet-blue radial from above, plus one wide low ambient. Never a second competing source."
  blueprint:
    description: "80px lattice at ~3% of #BACDF7. Present in every frame at identical pitch and opacity."
---

# StackedPoker — Understand

## Brand truth

This spec is **mandated by the brief, not derived from the site capture.** The two
earlier films used `#8B5CF6` on `#0C101D`; this one uses **`#7C5CFF` on `#0D1526`**
with **`#5EA8FF`** as a full second accent. Do not substitute the older values.

The signature gradient `linear-gradient(135deg, #7C5CFF 0%, #5EA8FF 100%)` is
**scarce**: it appears on the word RANGES, on "Poker" in the wordmark, on
"By Playing.", on the spade icon container and on the CTA. Nowhere else.

## Forbidden

Casino green, bright red, gold, orange, neon yellow, rainbow gradients, green felt,
warm casino lighting. No pure black — the floor is `#080D1A`. No serif, no gaming
or futuristic faces. No chips, money, players, tables, or gambling imagery of any
kind. The product is education; the visual language is technology.

## Light

**One** dominant source: a soft violet-blue spotlight from above, wide and heavily
blurred, plus one large low ambient glow for depth. No rim-light on every element,
no glow around every card, no cyberpunk. Apple product launch, not gaming ad.

## Type

Geist Sans everywhere; Geist Mono only for small technical labels at 0.18em
tracking, uppercase. Headlines 800–900 with tight tracking. One headline per scene,
never more than two lines.
