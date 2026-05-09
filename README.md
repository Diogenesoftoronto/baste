# Baste

**Persona-Driven Asset Generation for Unique UIs**

Baste transforms generic interfaces into culturally rich, personally meaningful experiences by using AI to generate custom SVGs, images, and video assets tailored to a specific persona's aesthetic DNA.

Now with **semantic version control for design systems** and **OpenPencil bridge** for editable design components.

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

# Export design tokens
baste tokens liminalweeb --format css   # css, tailwind, json
```

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

Cultural references are embedded in the design system history and exported with `.baste` files, so the "why" behind every design decision travels with the design.

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
    "model": "gpt-4o"
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
OPENAI_API_KEY=sk-...     # Image generation + LLM judge
QUIVER_API_KEY=qv-...      # SVG generation
GOOGLE_API_KEY=AIza...     # Video generation (optional)
```

## Architecture

```
Baste
├── Persona Engine          # Cultural identity, influences, aesthetic
├── Design System           # CSS/Tailwind/Panda tokens from persona
├── QD Engine               # Quality Diversity search for diverse assets
├── LLM Judge               # Evaluates persona alignment
├── Version Control (NEW)   # Lix-inspired semantic versioning
│   ├── SQLite database     # Change-first, not snapshot-first
│   ├── Branches            # Parallel design exploration
│   ├── Cultural refs       # Images, screenshots, logos linked to history
│   └── .baste exporter     # Portable design system packages
└── OpenPencil Bridge (NEW) # Editable .pen documents round-trip
```

## License

MIT
