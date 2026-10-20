---
workflow: motion-graphics
category: webpage
flow: autonomous
---

# Fitting loop — Baste hero motion

**Deliverables:** `renders/fitting-loop.mp4` (1200×630, 30fps, 8.0s, seamless loop) and
`renders/fitting-loop.gif` (960×504, 15fps, ≤ 4 MB, palette-optimised via ffmpeg palettegen/paletteuse)
plus a 1200×630 PNG still at t=1.6s → `renders/og-baste.png` (this replaces site/public/og-baste.png).

**What it says, without words:** one interface, cut three times. The same app screen is re-fitted
to three personas using their real generated tokens; nothing else changes.

## House style (the frame around the garment)
- Ground: pattern paper `#F1ECE2` with a 32px drafting grid `rgba(28,27,25,0.05)`.
- Ink `#1C1B19`, ink-muted `#6E6A61`, basting thread `#D2402A`, tailor's chalk `#2F55A4`, tape `#F0C534`.
- Faces (Google Fonts): Bodoni Moda (display, italic for the wordmark), IBM Plex Mono (chalk notes),
  plus each persona's faces below.

## Layout (1200×630)
- Left column (x 64–420): wordmark "Baste" Bodoni Moda italic 600, 56px, ink. Under it, two lines, Bodoni Moda 30px:
  "Cut to fit" / "*one* person." (*one* italic in `#A9311E`). Under that a 1.5px basting rule (12px dash / 8px gap, thread red).
  Bottom-left: mono 13px ink-muted "persona → tokens → interface".
- Centre (x 450–960): a bolt of cloth (rotated −1.6°, pinked/zig-zag top+bottom edge, soft drop shadow) dyed in the
  current persona's primary over its background as a visible plain weave: CSS `repeating-linear-gradient` warp
  (primary, 3px on / 3px off) over weft (background, 3px/3px) at 90°, with a subtle diagonal light gradient for folds.
  On it, pinned with two red pin heads (radial gradient #F38A74→#D2402A→#8E2615), the **garment card** (≈470×360):
  window chrome row (3 dots in primary/secondary/accent + mono "<id>.app / collections"), eyebrow (mono, primary,
  uppercase), heading (persona heading font, 34px, the persona's obsession), two buttons ("Start a collection" filled
  primary; "Browse" ghost), a "Pinned spaces" surface listing 3 spaces with coloured bullets, a "Now playing" surface
  (artist in heading font, genre muted, progress bar in primary), and 3 keyword chips. Card bg = persona background,
  surfaces = persona surface, borders = persona border, radii from persona tokens (radius.xl on card, radius.base on buttons),
  padding: minimal 26px / rich 20px / maximalist 12px.
- Right column (x 990–1160): chalk notes, mono 12px, each with a 1.5px dashed chalk left border:
  DISPLAY FACE <heading family> · PRIMARY <swatch + hex> · RADIUS <base · edge> · DENSITY <density>.

## Persona data (exact)
1. cyberbotanist — eyebrow "Pacific Northwest"; heading "Mycelial network topology"; spaces greenhouses, herbariums,
   maker spaces with plants; artist Biosphere / ambient; chips Mushishi, Ernst Haeckel, bioluminescent.
   primary #a15d3f secondary #5a8e3f accent #35f3b5 bg #fdf1eb surface #fffbf9 border #dacec9 text #211815 muted #685a54.
   heading 'Fraunces' (700), body 'Source Serif 4'. radius base 12px, xl 32px. density rich. edge organic.
2. nightmarketcoder — eyebrow "East Asian metropolitan"; heading "Point-of-sale systems"; spaces night markets,
   convenience stores at 2am, rooftops; artist Mariya Takeuchi / city pop; chips Chungking Express, night markets, neon signage.
   primary #e44635 secondary #ebb230 accent #fe12a9 bg #150d0c surface #211816 border #3a302e text #f5ecea muted #b1a09d.
   heading 'Dela Gothic One', body 'Instrument Sans'. radius base 4px, xl 12px. density maximalist. edge geometric.
3. liminalweeb — eyebrow "Digital native"; heading "Lost media"; spaces abandoned malls, empty pools, server rooms
   humming in the dark; artist Macintosh Plus / vaporwave; chips Serial Experiments Lain, liminal spaces, vaporwave.
   primary #3db2b2 secondary #dad59e accent #d658cc bg #081111 surface #121d1d border #2a3535 text #e7f1f0 muted #97a9a8.
   heading 'VT323' (set 42px to match optical size), body 'IBM Plex Sans'. radius base 8px, xl 16px. density minimal. edge soft.

## Timeline (8.0s, loop seamless: frame at 8.0 == frame at 0.0)
- Three fittings, ~2.67s each, in order cyber → night → liminal → (loop to cyber).
- Each fitting holds ~1.9s, then a **snip transition** (~0.7s): a dashed red thread line draws diagonally across the
  card (SVG stroke-dashoffset, power2.inOut 0.35s), then the old card is cut along it — the top-right piece slides/rotates
  away 30px and fades while the new fitting is revealed underneath via clip-path along the same diagonal (expo.out 0.45s).
  The cloth behind re-dyes at the same time (crossfade 0.5s). Chalk notes swap with a short 6px rise + fade, staggered 40ms.
- Constant subtle life: the pins rock ±1.5°, the cloth gradient drifts 6px (sine.inOut), never more.
- Arrange the 3 transitions so the loop point falls in the middle of the liminal→cyber hold (t=0 starts mid-hold of
  cyber with everything static); i.e. design the timeline as cyber hold [0,1.2], snip→night [1.2,1.9], night hold
  [1.9,3.85], snip→liminal [3.85,4.55], liminal hold [4.55,6.5], snip→cyber [6.5,7.2], cyber hold [7.2,8.0].
  The OG still at t=1.6s won't work (mid-snip) — use t=0.6s for og-baste.png instead.

## Gates
`npx hyperframes lint`, `check`, proof snapshots at 0.6, 1.55, 3.0, 5.5, 7.9 → contact sheet; frames at 0 and 8.0
must match. Fonts must be actually loaded (check snapshot glyphs). Render after gates pass (user pre-approved render).
