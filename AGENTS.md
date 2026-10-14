---
description: Baste - Persona-driven asset generation agent
---

# Baste agent guide

Generate UI assets from a persona's cultural influences: films, music, subcultures, spaces, tools and obsessions. Extract an aesthetic profile that drives design, rather than treating a persona as demographics.

## Method

1. Load/create a persona and optimize prompts for each asset type.
2. Run quality-diversity evolution for 5–10 iterations across color temperature, visual density and abstractness.
3. Keep the best candidate in each feature-space region, preserving diverse options.
4. Judge each candidate: persona alignment 30%, visual quality 20%, uniqueness 20%, coherence 15%, usability 15%.
5. Select a diverse final archive set; generate production assets and package metadata/relationships.

Services: QuiverAI for SVG/icons/illustrations/components; OpenAI GPT Image 2 for images/backgrounds/textures; Google Veo 3 for ambient loops/transitions.

Commands: `baste generate <persona-id>`, `baste ui-kit <persona-id>`, `baste list`, `baste show <persona-id>`.

Output lives in assets/output/{svg,images,videos}/ with {persona}-{purpose}-{timestamp} filenames, plus {persona}-suite.json.

Included personas: cyberbotanist (mycelium/bioluminescence/solarpunk), nightmarketcoder (neon markets/city pop/density), liminalweeb (abandoned malls/vaporwave/digital decay). Design should feel specific to their world and remain usable in real UIs.

Read [AGENT_REFERENCE.md](AGENT_REFERENCE.md), the exact original, on demand for the complete persona prompts, output tree and philosophy.
