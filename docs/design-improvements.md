# Baste — Design Improvement Report

*How to take Baste from "nicely styled" to a tool that makes designers stop scrolling.*

Baste already has something most dev tools never get: **a point of view.** The
TMNT/graffiti-neon identity (acid-lime → electric-purple → neon-fuchsia, drip
text, spray-paint scrollbar, splatter backdrops) is bold and consistent. The
recent pass unified the marketing page with that identity and fixed the
off-brand orange/amber drift. This report is about the next tier: the
**signature artifacts and details** that read, to a designer's eye, as *"a real
design team made this, and they care."*

The throughline: **a tool that generates taste must itself have taste.** Every
generic affordance (an emoji, a default form control, a stock spinner) quietly
undercuts the core pitch.

---

## 1. Iconography — the single biggest tell

**Problem.** The product leans on emoji as its icon language: 🍄 🌃 🌀 for
personas; 👤 ✨ 🧬 ⚖️ for the pipeline; 🎨 🖼️ 🎬 for outputs. Emoji render
differently per-OS, can't inherit brand color, can't animate, and signal
"prototype" to designers instantly. This is the highest-impact, most visible
weakness.

**Fix — a custom Baste icon set.** ~24–30 glyphs in one coherent style. Given
the brand, the right style is **spray-stencil / sticker**: chunky 2px strokes,
slightly rounded corners, a single optional "drip" accent, designed on a 24px
grid with a 2px safe-area. Deliver as a tree-shakeable inline-SVG component
(`<Icon name="persona" />`) so they inherit `currentColor` and the neon glows.

| Need | Replace emoji | Custom glyph idea |
|---|---|---|
| Persona | 👤 | masked stencil head |
| Generate | ✨ | spray-can with motion lines |
| QD evolution | 🧬 | branching paint-splat lattice |
| Judge | ⚖️ | dripping checkmark/stamp |
| Brand kit | 🎨 | paint roller |
| Decompose | — | URL → shattered tiles |
| Remix | — | two cans crossing streams |
| Tokens | — | swatch chip with tag string |

Keep emoji only where they're *content* (a user-authored persona's avatar), never
as *UI chrome*.

## 2. Logo into a brand **system**

The `BasteLogo` slime-badge "B" is genuinely good. Right now it's a one-off.
Promote it to a system designers can feel:

- **Favicon + PWA icons** generated from the mark (currently likely default).
- **Open Graph / social card** — a designed 1200×630 with the drip wordmark and
  a persona preview, so shared links look intentional.
- **Loading + empty states** that use the mark: a spray-can filling up, or the
  "B" dripping into place. Replace any default spinner.
- **404 / error pages** with a "tag got painted over" gag — cheap delight, high
  memorability.
- **Wordmark lockups**: horizontal, stacked, mark-only, and a monochrome
  "stencil" variant for dark/light/print.

## 3. Signature moments (the "jump-out" artifacts)

These are the things that get screenshotted and shared. Pick 2–3 and execute them
to a high finish rather than doing all of them halfway.

- **Persona Trading Cards.** Render each persona as a collectible card with a
  **holographic/foil sheen** on hover (CSS conic-gradient + `mix-blend-mode`
  tracking the pointer), a rarity tag, and its palette as a foil strip. This
  reframes "personas" from a list into a *collection* — instantly memorable and
  on-theme.
- **The Brand-Kit Zine.** When a persona's kit is generated, offer a one-click
  **printable zine / sticker sheet** export (PDF or long-image): cover, palette,
  type specimen, icon sheet, do/don'ts. A *tangible artifact* is the strongest
  possible proof the tool produces real design output.
- **Spray-reveal transitions.** Section/tab reveals as a quick stencil-mask
  spray (clip-path or masked PNG), not fade/slide. One custom transition used
  consistently = signature.
- **Tag-style section dividers.** Hand-drawn marker underlines / torn-tape
  dividers between landing sections instead of plain whitespace, tying the
  marketing flow to the graffiti world.
- **Live "tagging" cursor (optional, tasteful).** On the hero only, a faint
  spray trail that fades — delightful once, annoying everywhere, so scope it.

## 4. Typography with more attitude

Bowlby One (display) + Inter (body) is a safe, legible pair — but Inter is the
single most-used font on the web, which works *against* a tool selling
distinctiveness.

- Keep Bowlby/graffiti for hero/tag headlines.
- Swap body to something with a little more character but still neutral —
  **Space Grotesk**, **General Sans**, or **Geist** — or pair a distinctive
  **mono** (Departure Mono, Commit Mono, JetBrains Mono) for all the code/CLI
  surfaces, which are everywhere in this product.
- Add a **type-specimen page** in the Studio so users see (and trust) the type
  system — and it doubles as a feature demo.
- Use a **variable font** for the headline so weight can animate on the drip
  reveal.

## 5. Color & surface depth

The palette is strong; the *surfaces* are flat. Add depth without losing the
neon:

- **Texture passes**: the `.baste-noise` and risograph/halftone grain already
  hinted at — apply a subtle halftone to card backgrounds and a paper grain to
  light persona cards (Cyberbotanist) so they feel *printed*, not CSS.
- **Layered drop shadows** in brand hues (the new buttons do this; extend the
  "hard offset + glow" shadow into a reusable elevation scale: `sticker-sm`,
  `sticker-md`, `sticker-lg`).
- **Contrast guardrails**: acid-lime text on dark is great; lime-on-light and
  muted `text-muted` (#9A8FB5) on `#0A0A12` should be checked against WCAG AA.
  Ship a `tokens` lint that flags any generated pair below 4.5:1 — *a design tool
  that enforces contrast is a selling point.*

## 6. Custom form controls in the Studio

Default `<input>`/`<select>`/`<range>` are where the polish leaks out. The Studio
is the part designers will actually live in, so the controls should carry the
brand:

- **Sliders** rendered as a paint-drip track with a spray-cap thumb.
- **Toggles** as a sticker that peels/sticks.
- **Toasts** as a sprayed tag that drips in from a corner (the toast already uses
  brand colors — push it further).
- **Color swatches / palette editor** with a tactile chip + eyedropper, since
  color *is* the product.
- **Empty states with voice** ("No personas yet — go tag one") + the mascot,
  instead of blank panels.

## 7. Motion language

One consistent motion vocabulary beats many ad-hoc animations. Define it once:

- **Easing**: a single signature curve (slightly overshooting, "paint settling").
- **Entrances**: stencil-spray or drip-in.
- **Hover**: the hard-offset translate + glow already on buttons → standardize.
- **Reduced-motion**: provide calm fallbacks (`prefers-reduced-motion`), since
  splatter/drip can be a lot.

## 8. A mascot / character

The graffiti world wants a character. A simple **spray-can or slime blob mascot**
(2–3 expressions) used in empty states, loading, onboarding, and the 404 gives
the brand a face and is extremely shareable. Low cost, high recall.

---

## Prioritized roadmap

| Priority | Item | Impact | Effort |
|---|---|---|---|
| **P0** | Custom SVG icon set (replace UI emoji) | ★★★★★ | M |
| **P0** | OG/social card + favicon system | ★★★★ | S |
| **P1** | Persona trading cards (holo hover) | ★★★★★ | M |
| **P1** | Custom loading/empty states + mascot | ★★★★ | M |
| **P1** | Body/mono type refresh + specimen page | ★★★ | S |
| **P2** | Brand-kit zine / sticker-sheet export | ★★★★★ | L |
| **P2** | Spray-reveal transition + motion system | ★★★ | M |
| **P2** | Custom Studio form controls | ★★★ | M |
| **P3** | Texture/halftone surface pass | ★★ | S |
| **P3** | Contrast lint on generated tokens | ★★★ | M |

**If you only do three things:** (1) kill the UI emoji with a custom icon set,
(2) ship persona trading cards, (3) make the brand kit export a tangible
artifact (zine/sticker sheet). Those three turn "a styled web app" into "a tool
with a craft story" — which is exactly what makes designers trust it.

---

## Caveats noted in code (worth a pass)

- Several landing `<img>` elements lack `width`/`height` (Qwik lint warnings) —
  set intrinsic dimensions to prevent layout shift.
- Persona-card colors previously passed PandaCSS token *names* into raw CSS
  (now fixed with hex); keep persona-data colors as literal hex/`rgb` so they
  survive both `style={}` and string interpolation.
- `text-muted` on the darkest background is borderline for body copy — verify AA.
