# Baste

**Persona-Driven Asset Generation for Unique UIs**

Baste transforms generic interfaces into culturally rich, personally meaningful experiences by using AI to generate custom SVGs, images, and video assets tailored to a specific persona's aesthetic DNA.

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

## Built-in Personas

| Persona | Description | Aesthetic |
|---------|-------------|-----------|
| `cyberbotanist` | Mycelial networks, bioluminescence, solarpunk | Warm, organic, textured |
| `nightmarketcoder` | Neon night markets, city pop, chaotic density | Warm, maximalist, snappy |
| `liminalweeb` | Abandoned malls, vaporwave, digital decay | Cool, minimal, grainy |

## Environment Variables

```bash
OPENAI_API_KEY=sk-...     # Image generation + LLM judge
QUIVER_API_KEY=qv-...      # SVG generation
GOOGLE_API_KEY=AIza...     # Video generation (optional)
```

## Persona JSON Format

```json
{
  "id": "my-persona",
  "name": "My Persona",
  "summary": "Brief description",
  "culture": {
    "region": "Pacific Northwest",
    "subcultures": ["solarpunk", "biohacking"],
    "values": ["interconnectedness", "growth"]
  },
  "influences": {
    "films": ["Annihilation"],
    "anime": ["Mushishi"],
    "music": { "genres": ["ambient"], "artists": ["Biosphere"] },
    "spaces": ["greenhouses"],
    "obsessions": ["mycelial networks"]
  },
  "behaviors": {
    "interfaceValues": ["discoverability"],
    "petPeeves": ["aggressive notifications"]
  },
  "aesthetic": {
    "colorTemperature": "warm",
    "density": "rich",
    "edgeStyle": "organic",
    "motionStyle": "smooth",
    "typographyStyle": "handcrafted",
    "textureStyle": "textured",
    "iconStyle": "hand-drawn",
    "layoutStyle": "organic",
    "visualKeywords": ["organic", "bioluminescent"],
    "moodKeywords": ["growth", "interconnectedness"]
  }
}
```

## License

MIT
