---
workflow: product-launch-video
flow: automation
storyboard: no
message: "Design for the person, not the persona document — Baste turns one person's taste into a whole interface, and shows you the spread of options it found."
destination: website (Baste landing page and Studio guide)
aspect: 1920x1080
language: en
length: 90s
angle: product demo
voice: Cartesia sonic-3.6, Theo (shared with the Studio guide narration)
---

## Intent

Show designers and developers what using Baste is like and why they'd use it.
The user asked for "full demonstrations of the wonderful abilities of baste.
what it is like to use it and why you would", with generation done on fal.
Warm, particular and confident — a tailor's atelier, not a SaaS explainer.

## Story

1. **Why.** Interfaces are cut for "users aged 25–34", who have no taste. A person does.
2. **Measure.** A persona is films, music, rooms, tools and pet peeves — not demographics.
3. **The fitting.** The same screen re-cut for Moss, Ren and Ada: layout, type, colour, motion.
4. **Baste.** A real fal run: 24 candidates generated and judged by a vision model that looks at every image; the archive keeps the best in each region of colour temperature × density.
5. **Fit.** The judge's weights: persona alignment 30, quality 20, uniqueness 20, coherence 15, usability 15.
6. **Cut.** The finished suite: hero, background, Recraft vector icons, ambient loops, tokens as CSS/Tailwind/Panda/JSON.
7. **Talk.** Ask the persona why — the conversation explains their taste in their own voice.
8. **Make your own.** Studio, `npx baste gui`, `--provider fal`.

## Assets

- Real Studio and site screen recordings captured from http://127.0.0.1:5173 (landing, /gui, replayed recorded run).
- Real generated outputs: `site/public/assets/fittings/` (heroes, backgrounds, icons, loops) and `site/public/assets/fittings/runs/*.json` (all 72 judged candidates with scores).
- Companion portraits: `site/public/assets/companions/*.webp`.
- House style: pattern paper #F1ECE2, ink #1C1B19, thread #D2402A, chalk #2F55A4, tape #F0C534; Bodoni Moda, Instrument Sans, IBM Plex Mono.

## Notes

- Everything shown is real output from this repository; no mocked UI and no invented capabilities.
- Personas are authored characters, never presented as real people.
- Captions in English (burned in for muted autoplay) and a WebVTT track.
