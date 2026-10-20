# Baste

**Interfaces cut to fit one person.**

![One interface, fitted to three personas](docs/fitting-loop.gif)

**[Watch the 74-second tour](site/public/media/tour/baste-tour.mp4)**: measure a person, re-cut one screen for
three people, judge two dozen drafts, keep the files. It plays on the site's home page and in the Studio guide
(`/docs/`), with English and French captions.

*Baste (v.) — to tack a garment together with long, loose stitches so it can be fitted before the final cut.*

Baste takes a persona's films, music, rooms, tools and obsessions, and from them drafts the design system, icons,
images and motion that fit. Palettes and typefaces are derived from the persona's cultural references, so no two
personas come out the same. Then it explores many candidates with quality-diversity search, judges them for
persona fit, and cuts the winners into production assets.

Now with **semantic version control for design systems** and **OpenPencil bridge** for editable design components.

## The Studio

```bash
npx baste gui        # local API on :3456 — then open the site's /gui route
```

The Studio (`site/`, route `/gui`) puts one persona at the centre: see it **wearing its own design** (a live
try-on of the same screen in its tokens, with contrast checks), export tokens, draft prompts and generate assets
with a staged progress view, pin a moodboard, read a decomposed brand kit, teach it your taste, and edit tokens
as an OpenPencil document. Without a local server it runs in demo mode on the built-in personas.

Start the API and Qwik Studio together from the repository root:

```bash
devenv tasks run baste:install
devenv up
```

Open `http://localhost:5173/gui/` for the Studio and `http://localhost:5173/docs/` for documentation.
The site proxies `/api` to the Baste API on port 3456. Storybook is opt-in.
See [local development](docs/development.md) for tasks, port overrides and verification boundaries.

## Not Organic accounts

Studio Settings includes profile creation/sign-in through Not Organic, the authorized model catalog,
wallet credit and advertised checkout offers. Hosted image generation and Jev judging use server-held
PKCE/DPoP authorization. Design personas are separate from the public account profile, and account-owned
design files are isolated by DID. Local CLI generation continues to use your selected provider keys.

Enable `NOTORGANIC_ENABLED=true` with an exact `BASTE_PUBLIC_ORIGIN` after registering Baste's product
and origin on the provider. Payments require provider-configured offers and an HTTPS return origin.
Source integration does not establish that a deployed sign-in or paid checkout works.
See [Not Organic integration](docs/notorganic.md) for the configuration and API contract.

## Quick Start

```bash
# Install globally
npm install -g baste

# Or run directly with npx
npx baste list
```

## Commands

### Browse Personas

```bash
baste list              # List all personas (base + custom)
baste show cyberbotanist # Show persona details
```

### Create Custom Personas

```bash
# Extend from a built-in base persona
baste create mybotanist --base cyberbotanist --name "My Botanist"

# Create from a JSON file
baste create mypersona --from ./persona.json

# Delete a custom persona
baste delete mybotanist
```

Custom personas are saved to `./personas/` as JSON files and take priority over built-in personas.

### Generate Assets

```bash
# Generate asset suite for a persona
baste generate cyberbotanist

# Generate full UI kit
baste ui-kit nightmarketcoder --output-dir ./my-app/assets

# Dry run (see prompts without calling APIs)
baste generate cyberbotanist --dry-run

# One fal key for everything: Seedream images, Recraft SVG, Seedance video, a vision judge
baste generate cyberbotanist --provider fal

# Or choose per stage
baste generate cyberbotanist --image-provider fal --svg-provider quiver --judge openai

# Jev without images: judge prompts and SVG source only
baste generate cyberbotanist --judge typesafe --text-judge

# Export design tokens and motion primitives
baste tokens liminalweeb --format css   # css, tailwind, json
```

### How Jev judges

With `TYPESAFE_API_KEY` set, [Jev](https://docs.typesafe.ai) judges every QD candidate and final asset. It now
looks at them, using TypeSafe's image preview ([images](https://docs.typesafe.ai/images.md), opt-in header
`TypeSafe-Danger-Zone-Images`):

| Jev sees | As | What it decides |
|---|---|---|
| The candidate | The rendered image; an SVG on light and dark grounds at 64, 32 and 16 px; six frames of a video | The five scores, from pixels instead of the prompt |
| The persona's world | Up to four pictures: moodboard pins, `baste culture` images, a decomposed site's share image and palette | Persona alignment against what the world looks like |
| The suite | The latest finished asset of each purpose (up to four) | Coherence with what was actually rendered |
| Your ratings | Up to three upvoted and three downvoted assets of the same kind, as pictured criteria | A taste judgment that moves persona alignment by up to ±0.1 |

From the same request, Jev also reads the QD archive's three axes (colour temperature, density, rendering) off
the image, replacing the keyword guesses that placed candidates before. For images and loops, it checks for text laid over the picture: a caption, watermark or interface label rejects the asset at 0.8.
Signs and lettering in the scene are allowed. For loops, it reads the frames for motion (which of the four motion
languages they show, whether the last frame flows into the first, and how much the movement competes with
interface content) and turns misses into `improvements` without rejecting the loop.

Video frames need `ffmpeg` and `ffprobe` on `PATH`; WebP and GIF stills use them too. Without them, those assets
are judged on their prompt. TypeSafe never resizes, so Baste fits every image inside its limits (280–1568 px a
side) and uploads lossless PNG. TypeSafe also takes JPEG, but its artifacts would be judged as the asset's. If TypeSafe refuses an image request (`400` or `413`), the same
asset is judged again as text, and its result carries the `vision-refused` tag. `--text-judge`, or
`"vision": false` in the evaluator config, keeps every judgment text-only. Hosted Not Organic judging is text-only.
Each result records what Jev saw (`evidence`: `text-only`, `image` or `frames`) and its readings, in the suite
manifest and the Studio.

### Motion primitives

Every persona's `motionStyle` (smooth, snappy, liquid, mechanical) defines one motion language. The same language
writes the design tokens, the motion line in video prompts, and the options Jev chooses between when it reads a
loop. The language sets:

- **Curves**: `standard`, `enter` (decelerate), `exit` (accelerate), `emphasis`, and a physical spring
  (stiffness, damping, mass) exported as a CSS `linear()` curve with its settle time.
- **Distances, press and stagger**: nudge, shift and travel lengths, a press scale and a stagger interval. Dense
  personas move less and sequence faster.
- **Moves**: `enter`, `exit`, `hover`, `press`, `emphasis` and an `ambient` loop, as Web Animations keyframes
  with timing. The loop breathes for smooth personas, flickers for snappy, drifts for liquid and ticks for mechanical.

`baste tokens <id> --format css` ships them as variables (`--ease-enter`, `--ease-spring`, `--motion-shift`, …),
`@keyframes`, `.motion-enter`/`.motion-exit`/`.motion-hover`/`.motion-press`/`.motion-emphasis`/`.motion-ambient`
classes and `.motion-stagger` for sequences. A `prefers-reduced-motion` block keeps opacity-only enters and exits
and stops travel, emphasis and loops. The Tailwind and Panda exports carry the same curves, durations and keyframes,
and JSON carries the full choreography for animation libraries. The Studio's Tokens tab plays each move.

### Edit, layer and animate

Creating and editing are separate roles. The image model draws; three more, all on one `FAL_KEY`, take it from
there:

| Role | Default model | What it does |
|---|---|---|
| Create | `generators.image` (GPT Image by default) | Draws each candidate from its prompt |
| Segment | `fal-ai/sam-3/image` (SAM 3) | Cuts the persona's subject out of an image, by name |
| Edit | `fal-ai/ideogram/v3/edit` (Ideogram 3) | Repaints the region around or inside that subject |
| Animate | `fal-ai/bytedance/seedance/v1/pro/image-to-video` (Seedance) | Turns a finished image into a loop |

```bash
# Repaint candidates during the search, and cut final images into layers
baste generate nightmarketcoder --edit

# Animate final images: parallax from their layers, a video loop, or both (both imply layers)
baste generate nightmarketcoder --animate both
```

**`--edit`:**
- About half of each generation's new candidates repaint a kept candidate's image instead of drawing anew. SAM 3
  finds the subject, and Ideogram repaints the background or the subject one step along the archive's axes. The
  persona's animation `focus` picks which.
- Jev judges an edit like any other candidate, and the candidate records which image it came from. Edits are
  capped at half a batch per generation.
- The final step now ships the image the search judged instead of drawing it again.

**Layers** (`assets/output/layers/`): each final image becomes the subject on transparency, the scene with the
subject painted out, and the mask. Jev picks which of the persona's subjects to cut, in the same request that scores
the image, and checks that the cut-out is whole and the background clean. A failed cut is dropped.

**Animation** (`assets/output/animation/`):
- **Parallax**: the layers move at different depths along the persona's camera. It ships as a self-contained HTML
  page (CSS only, no script, still under reduced motion) and a JSON spec. With ffmpeg, there's also an MP4 whose
  last frame meets its first.
- **Video**: Seedance animates the image, played forward and back so it loops. When the persona's focus region is
  small enough to keep the composition, it animates towards an end frame Ideogram paints with the motif at its
  height. Jev reads the loop's frames for motion style, seam, calm and any motion the persona avoids.

Each persona describes how its world moves in an optional `animation` block:
- `motifs`: what moves
- `subjects`: what can be cut out
- `depth`: flat, parallax or deep
- `camera`: locked, drift, push or orbit
- `focus`: background, subject or both
- `loopSeconds`
- `avoid`: motion the persona can't stand

The three built-in personas have one; others derive it from their aesthetic. Edit it in the Studio's persona form
or through the MCP `create_persona` tool. Hosted Not Organic runs can't edit or animate yet.

```json
{
  "edit": false,
  "animate": false,
  "generators": {
    "edit": { "provider": "fal", "model": "fal-ai/ideogram/v3/edit", "renderingSpeed": "BALANCED" },
    "segment": { "provider": "fal", "model": "fal-ai/sam-3/image" },
    "animate": { "provider": "fal", "model": "fal-ai/bytedance/seedance/v1/pro/image-to-video", "resolution": "720p" }
  }
}
```

fal's Ideogram edit repaints the *white* of a mask, the opposite of Ideogram's own API documentation. This was
checked live; `EDIT_COLOR` in `src/assets/layers.ts` flips every mask if it changes.

### Design Version Control

**Semantic version control** for design components and cultural experiences. Track every token change, cultural reference, and design decision as semantic changes (not just file diffs).

```bash
# Initialize version control for a persona
baste init cyberbotanist

# Show full history (commits, changes, cultural refs)
baste history cyberbotanist --limit 20

# Update a design token (creates a semantic change record)
baste update cyberbotanist colors.primary "#FF6B35"
baste update cyberbotanist typography.fontFamily.heading "'Space Grotesk', sans-serif"

# Create a design branch for exploration
baste branch cyberbotanist "neon-alternate"
baste switch cyberbotanist "neon-alternate"

# Diff two versions
baste diff <version-id-1> <version-id-2>

# Revert to previous version (creates new revert commit)
# (use the registry API programmatically)
```

### Decompose a Live Site

Pull a real URL into a Baste persona + brand kit (palette with role assignment, fonts, `@font-face` URLs, logo, OG image, image inventory, plus inferred aesthetic signals).

```bash
# Basic: fetch HTML + linked CSS, extract palette/fonts/logo
baste decompose https://qwik.dev --id qwik

# Deep: full JS rendering via Playwright (required for SPA sites)
baste decompose https://example.com --deep

# Mirror logo/OG/images to disk; auto-initialize design versioning
baste decompose https://stripe.com --mirror-assets --init

# Custom slug + display name
baste decompose https://acme.example --id acme --name "Acme Co."
```

Outputs:
- `./personas/<id>.json` — the draft persona (aesthetic inferred from extracted signals)
- `./personas/<id>.brandkit.json` — literal extracted artifacts (palette roles, font-faces, image URLs, signals)
- `./assets/decomposed/<id>/` — mirrored logo/OG/thumbnails (with `--mirror-assets`)

The extracted palette and fonts flow into `baste tokens <id>` automatically — `--color-primary` will be the real brand color.

**Deep mode** requires Playwright. Install once:
```bash
npm install --save-dev playwright && npx playwright install chromium
```

### Remix Personas

Cross two personas (and their brand kits) into a new one:

```bash
baste remix cyberbotanist nightmarketcoder --as solar-night
```

### Cultural Experiences

Link images, screenshots, logos, and references to personas to capture the cultural DNA behind design decisions.

```bash
# Show cultural references for a persona
baste culture cyberbotanist

# Add cultural references from images
baste culture cyberbotanist ~/Pictures/cultural/hero-ref.png ~/Pictures/cultural/palette-inspiration.jpg

# Scan an entire directory
baste culture nightmarketcoder ~/Pictures/memes/
```

Cultural references are embedded in the design system history and exported with `.baste` files, so the "why" behind every design decision travels with the design. Image references are also shown to Jev when it judges that persona's assets. A `.baste` import keeps a reference's URL but drops its local path, which names a file on the sender's machine.

### Export / Share / Import

**The `.baste` format**: portable, self-contained design system packages.

```bash
# Export persona's complete design system (persona, tokens, history, refs)
baste export cyberbotanist ./cyber-design.baste

# Import a design system (creates new branch if persona exists)
baste import ./some-design.baste

# Export to OpenPencil for visual editing
baste openpencil cyberbotanist ./cyber-editable.pen
```

`.baste` files contain:
- Full persona definition
- All design tokens (with history)
- Cultural references (with rationale)
- Version graph (branches, commits, semantic changes)
- Embedded assets (small files as data URLs)
- Compatibility metadata

### Configuration

```bash
# Create default config file
baste config --init

# Get/set config values
baste config --get qd.iterations
baste config --set qd.iterations 10

# Use custom config file
baste generate cyberbotanist --config ./my-config.json
```

Config is loaded from `baste.config.json` or `.bastec.json` in the current directory.

### Web GUI

```bash
# Start the web interface
baste gui --port 8080
```

Browse to `http://localhost:8080` to create, edit, and manage personas through a visual interface.

## Configuration File

`baste.config.json`:

```json
{
  "outputDir": "./assets/output",
  "personaDir": "./personas",
  "evaluator": {
    "model": "gpt-4o",
    "vision": true
  },
  "qd": {
    "iterations": 5,
    "batchSize": 3,
    "mutationRate": 0.4,
    "qualityThreshold": 0.5
  },
  "outputCount": 3,
  "generators": {
    "image": { "provider": "openai", "model": "gpt-image-2" },
    "svg": { "provider": "quiver" },
    "video": { "provider": "veo" }
  }
}
```

## Programmatic API

### Persona Management

```typescript
import { getPersona, savePersona, buildPersona, extendPersona } from "baste";
import { generateUIKit } from "baste";

// Get a persona
const persona = getPersona("cyberbotanist");

// Create custom persona
const draft = buildPersona({
  id: "mypersona",
  name: "My Persona",
  summary: "A brief description",
  culture: { subcultures: ["solarpunk"], values: ["growth"] },
  influences: { films: ["Annihilation"], music: { genres: ["ambient"], artists: [] } },
  behaviors: { interfaceValues: ["discoverability"], discovery: [], platforms: [], expression: [], petPeeves: [] },
  aesthetic: { colorTemperature: "warm", density: "rich", visualKeywords: ["organic"], moodKeywords: ["growth"] },
});
savePersona(draft);

// Extend from a base
const variant = extendPersona(persona!, { id: "variant", name: "Variant" });
savePersona(variant);

// Generate UI kit
const kit = await generateUIKit(persona!, config);
```

### Design Version Control

```typescript
import {
  DesignVersionRegistry,
  exportDesignSystem,
  importDesignSystem,
  exportToOpenPencil,
} from "baste";

const registry = new DesignVersionRegistry({ author: "designer@team" });

// Initialize version control for a persona
const { branch, version, component } = registry.initPersona(persona);

// Update tokens (semantic change tracking)
const { changes } = registry.updateComponentTokens(component.id, (tokens) => ({
  ...tokens,
  colors: { ...tokens.colors, primary: "#4A7C59" },
}));

// Add cultural references from images
const refs = registry.scanCulturalImages(
  persona.id,
  ["~/Pictures/kill-la-kill-reference.jpg", "~/Pictures/veritas-logo.png"],
  "Core aesthetic references"
);

// Create design branch for exploration
registry.createBranch(persona.id, "neon-exploration");
registry.switchBranch(persona.id, "neon-exploration");

// Export for sharing
registry.exportToFile(persona.id, "./my-design.baste");

// Export to OpenPencil for visual editing
await registry.exportToOpenPencilFile(persona, "./editable.pen");

// Import from a shared `.baste`
const imported = registry.importFromFile("./shared-design.baste");

// Show history
console.log(registry.getHistoryLog(persona.id));

// Diff between versions
const diff = registry.diff("version-a", "version-b");
```

### Semantic Change Types

Every design change is tracked with semantic meaning:

| Change Type | What it means |
|------------|---------------|
| `color_change` | Token color changed (e.g., primary: `#8B6914` → `#4A7C59`) |
| `typography_change` | Font or type scale changed |
| `spacing_change` | Spacing or density changed |
| `border_change` | Border radius/style changed |
| `shadow_change` | Shadow or glow changed |
| `motion_change` | Timing/easing changed |
| `cultural_ref_added` | New cultural reference added to persona |
| `cultural_ref_removed` | Cultural reference removed |
| `persona_updated` | Persona definition changed |
| `merge` | Design system merge occurred |
| `custom` | User-defined change |

### OpenPencil Bridge

Convert Baste personas to editable OpenPencil documents:

```typescript
import { personaToOpenPencil, serializeOpenPencil, extractTokensFromOpenPencil } from "baste";

// Export to editable format
const doc = personaToOpenPencil(persona, tokens, culturalRefs);
const json = serializeOpenPencil(doc);

// Edit in OpenPencil, then import back
const modifiedTokens = extractTokensFromOpenPencil(doc);
```

The OpenPencil document contains:
- **Design Tokens page**: All tokens as visual swatches (colors, fonts, spacing, borders, motion)
- **Cultural Board**: Mood keywords and visual references organized as frames
- **Component Library**: Button primary, Card, Hero Section ready to use
- **Cultural Context**: Embedded rationale for why each choice was made

## Built-in Personas

| Persona | Description | Aesthetic |
|---------|-------------|-----------|
| `cyberbotanist` | Mycelial networks, bioluminescence, solarpunk | Warm, organic, textured |
| `nightmarketcoder` | Neon night markets, city pop, chaotic density | Warm, maximalist, snappy |
| `liminalweeb` | Abandoned malls, vaporwave, digital decay | Cool, minimal, grainy |

## `.baste` File Format

The `.baste` format is a shared, version-controlled design system that can be passed between people and tools:

```json
{
  "version": "0.2.0",
  "schema": "baste-design-v1",
  "persona": { ...full persona definition... },
  "components": [ ...design components with tokens... ],
  "versions": [ ...commit history... ],
  "changes": [ ...semantic changes... ],
  "culturalRefs": [ ...references with rationale... ],
  "metadata": {
    "name": "Cyberbotanist Theme",
    "exportFormat": "baste",
    "compatibility": ["open-pencil", "baste-cli", "lix-v1"]
  }
}
```

- **Portable**: Single JSON file
- **Self-contained**: Embeds assets as data URLs
- **Versioned**: Full history graph included
- **Culturally annotated**: References explain *why* each choice was made
- **Tool-agnostic**: Works with OpenPencil, any CLI, Lix-aware systems

## Environment Variables

```bash
OPENAI_API_KEY=sk-...      # GPT Image 2.5 + fallback OpenAI judge
QUIVER_API_KEY=qv-...      # SVG generation
ARK_API_KEY=...           # Seedance video generation (default)
TYPESAFE_API_KEY=...      # TypeSafe System One (Jev) judge, auto-selected when set; looks at images
GOOGLE_API_KEY=AIza...     # Gemini images / Veo video (optional)
FAL_KEY=...                # fal: --provider fal for every stage, and companion voice
```

## The tour video

The tour is a [HyperFrames](https://hyperframes.heygen.com/) composition in `videos/baste-tour/`, cut from
screens recorded on this site. `scripts/record-tour.mjs` records them, `scripts/narrate-tour.mjs` and
`scripts/score-tour.mjs` make the narration and music on fal, `build.mjs` composes it, and `publish.mjs` puts the
video, captions and the Studio guide's chapter clips into `site/public/media/tour/`. See
[local development](docs/development.md#tour-video) for the commands.

## Architecture

```
Baste
├── Persona Engine          # Cultural identity, influences, aesthetic
├── Design System           # CSS/Tailwind/Panda tokens from persona
├── QD Engine               # Quality Diversity search for diverse assets
├── Motion primitives       # Curves, spring, moves; tokens, video prompts, Jev
├── Layers and animation    # SAM 3 cut-outs, Ideogram edits, parallax and Seedance loops
├── Judges                  # Jev (looks at pixels and frames), OpenAI, fal vision
├── Version Control (NEW)   # Lix-inspired semantic versioning
│   ├── SQLite database     # Change-first, not snapshot-first
│   ├── Branches            # Parallel design exploration
│   ├── Cultural refs       # Images, screenshots, logos linked to history
│   └── .baste exporter     # Portable design system packages
└── OpenPencil Bridge (NEW) # Editable .pen documents round-trip
```

## License

MIT

### Hosted account credits

Use Not Organic without configuring individual provider keys:

```sh
baste login
baste credits
baste credits --buy <advertised-pack-id>
baste generate cyberbotanist --provider notorganic --iterations 0 --batch-size 1 --output-count 1 --max-cost 5 --edit --animate parallax
baste logout
```

Signed-in Studio runs and hosted CLI runs use account credits for image generation, Jev, SAM segmentation, Ideogram edits and Seedance animation, when the provider advertises those roles. The plan checks a conservative spending ceiling before paid work. Checkout requires the user to complete payment; verify credit afterward with `baste credits`. See [account setup](docs/notorganic.md) for client registration, private device credentials, required gateway prices and async storage.
