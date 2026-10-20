# Baste: colour, dynamics and interaction

Open the local Material room at http://127.0.0.1:5211/materials/ while the Baste site is running. The route is `/materials/` on any site build, with links from navigation, Studio, the pattern book and footer.

## Live materials

Six WebGL techniques: shot silk, thread currents, interference, chalk contours, marbled dye and radial pleats. They share editable ground/warp/weft colours, deterministic seeds, scale, density, distortion, dye strength and motion speed. Colour controls include classic RGB, perceptual OkLab and shortest-path hue interpolation, a hue rotation, and optional continuous dye cycling. Move the pointer to bend the material; tap/click to send a ripple. The silk technique has a separate thread-width control.

Motion can be paused while explicit pointer interaction remains available. Reduced-motion preferences stop automatic animation, colour cycling and pointer response; colour and composition controls still work. Offscreen/hidden previews stop rendering. WebGL failure retains a flat ground-colour preview and recipe editing; context loss explains reload recovery and disables PNG export.

Changes autosave on the device. Export PNG saves the current preview at its display resolution without the type sample. Save/load recipe preserves the parameters, not the elapsed animation time or pointer state. The “Use behind Baste” action applies a quiet version under a 90% paper wash; “Restore original linen” restores the original mode and palette. No server, provider or paid service is required for the live room.

The live renderer is Baste's own WebGL implementation inspired by Graphite's techniques. It does **not** evaluate `.graphite` documents. Baste JSON recipes and native Graphite documents are separate formats.

## Native Graphite studies

The connected `graphite-editor` MCP and pinned `graphene-cli` engine produced 20 candidates: five rounds in each of four families. The round sweep changes palette/temperature, density, fractal seed/scale/warp, gradient colour space or repetition angle/count, depending on the family. All 20 candidates remain in the archive. Subjective contact-sheet ratings use the Baste weights (alignment 30%, quality 20%, uniqueness 20%, coherence 15%, usability 15%); they are editorial selections, not model or user efficacy measurements.

Selected families:

- Chromatic bath: multi-stop perceptual gradient, cyclic gradient shift, domain-warped fractal noise.
- Chalk strata: repeated gradient stops map a fractal height field into blue-and-paper contour bands.
- Radial dye: repeated vector strips, animation-time-driven rotation and gradient shift.
- Interference weave: two rotated arrays of gradient-dyed vector strips.

Production PNG/WebP assets are in `../images/`, two vector SVG exports in `../svg/`, and two 640×400 GIF studies in `../videos/`. Every GIF contains 64 distinct frames and loops indefinitely. GIF timing is quantized to its format; inspect the suite manifest for actual duration. The static high-resolution assets are 2560×1600. The colour palette and structure are evaluated at their output resolution; noise scale uses Graphite document units.

`documents/` contains 27 native node documents: 20 candidates, four high-resolution drawings, two animated drawings and a pointer-driven radial drawing. Nodes have labels, input names and a readable grid layout. Native files and smaller web previews are served from `site/public/materials/graphite/` and linked from the Material room.

AnimationTime, Math and GradientShift were actually rendered as animated Graphite exports. PointerPosition compiles and renders headlessly with the pointer at its default origin. Native editor pointer behaviour has not been exercised; the browser's Baste pointer/tap behaviour is verified separately. Open the pointer drawing in Graphite to experiment with the centre following the document pointer.

## Reproduce

These sources use the installed MCP at `~/.local/share/graphite-editor-mcp`; Graphite pin `d7ae6029e0c1818d81a13b0389ef1808496a715b`.

```
rtk proxy node assets/output/graphite-experiments-20261001/source/graphite.mjs inspect
rtk proxy node assets/output/graphite-experiments-20261001/source/studies.mjs
rtk proxy node assets/output/graphite-experiments-20261001/source/studies.mjs --final-only
rtk proxy node assets/output/graphite-experiments-20261001/source/pointer-study.mjs
rtk proxy node assets/output/graphite-experiments-20261001/source/layout-documents.mjs
rtk proxy node assets/output/graphite-experiments-20261001/source/vectors.mjs
```

The suite manifests retain file hashes and renderer results. `qa/interaction-report.json` contains the focused browser checks; `qa/v2-qa.json` contains viewport/overflow and browser-error checks. `source/qa.mjs` uses the available bundled Playwright runtime and browser; adjust its paths for another machine. Recipe input-boundary and round-trip checks live in the site's material tests.
