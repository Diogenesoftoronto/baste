#!/usr/bin/env node
/**
 * Baste CLI
 *
 * Commands:
 *   baste generate <persona> [options]
 *   baste ui-kit <persona> [options]
 *   baste list
 *   baste show <persona>
 *   baste tokens <persona> [--format]
 *   baste create <name> [--base <base-id>] [--from <json-file>]
 *   baste delete <persona-id>
 *   baste config [--get <key>] [--set <key> <value>]
 *   baste gui [--port]
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import {
  getPersona,
  listPersonas,
  isBasePersona,
  isCustomPersona,
  savePersona,
  deletePersona,
  initStore,
  getBasePersonas,
} from "./persona/store.js";
import { buildPersona, extendPersona, type PersonaDraft } from "./persona/builder.js";
import { generateAssetSuite, generateUIKit } from "./baste.js";
import { defaultAssetFeatures } from "./generation/qd.js";
import {
  resolveConfig,
  toBasteConfig,
  loadConfigFile,
  defaultConfig,
  type BasteUserConfig,
} from "./config/baste-config.js";
import { startGUIServer } from "./gui/server.js";

const args = process.argv.slice(2);
const command = args[0];

function printHelp() {
  console.log(`
Baste - Persona-Driven Asset Generation

Usage:
  baste generate <persona-id> [options]    Generate assets for a persona
  baste ui-kit <persona-id> [options]       Generate full UI kit
  baste list                                List all personas (base + custom)
  baste show <persona-id>                   Show persona details
  baste tokens <persona-id> [--format]      Export design tokens
  baste create <id> [options]               Create new custom persona
  baste delete <persona-id>                 Delete a custom persona
  baste config [options]                    Manage configuration
  baste gui [--port <n>]                    Start web GUI

Create options:
  --name <name>                             Display name for the persona
  --summary <text>                          Brief description
  --base <base-id>                          Extend from a base persona
  --from <json-file>                        Load from a JSON file
  -i, --interactive                         Interactive creation

Config options:
  --get <key>                               Get a config value
  --set <key> <value>                       Set a config value
  --init                                    Create default config file

Global options:
  --config <path>                           Config file path
  --output-dir <path>                       Output directory
  --iterations <n>                          QD iterations
  --batch-size <n>                          Batch size per iteration
  --output-count <n>                        Final assets to generate
  --model <model>                           Evaluator model
  --dry-run                                 Show prompts without generating

Examples:
  baste generate cyberbotanist
  baste ui-kit nightmarketcoder --output-dir ./my-app/assets
  baste create mypersona --name "My Persona" --base cyberbotanist
  baste config --init
  baste gui --port 8080
`);
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-/g, "");
      const next = args[i + 1];
      if (next && !next.startsWith("--") && !next.startsWith("-")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else if (arg.startsWith("-") && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next && !next.startsWith("-")) {
        options[key] = next;
        i++;
      } else {
        options[key] = true;
      }
    } else {
      if (!options._positional) options._positional = arg;
      else if (!options._positional2) options._positional2 = arg;
    }
  }
  return options;
}

function buildBasteConfig(options: Record<string, string | boolean>, explicitConfig?: BasteUserConfig) {
  const fileConfig = explicitConfig || resolveConfig();
  const base = toBasteConfig(fileConfig);

  return {
    generation: {
      ...base.generation,
      outputDir: String(options.outputdir || base.generation.outputDir),
    },
    qd: {
      ...base.qd,
      iterations: parseInt(String(options.iterations || base.qd.iterations)),
      batchSize: parseInt(String(options.batchsize || base.qd.batchSize)),
    },
    outputCount: parseInt(String(options.outputcount || base.outputCount)),
    evaluator: {
      ...base.evaluator,
      model: String(options.model || base.evaluator.model),
    },
  };
}

async function main() {
  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const options = parseArgs(args.slice(1));

  // Initialize persona store with custom dir from config
  const fileConfig = options.config
    ? loadConfigFile(String(options.config))
    : resolveConfig();
  if (fileConfig.personaDir) {
    initStore({ customDir: fileConfig.personaDir });
  } else {
    initStore();
  }

  switch (command) {
    case "list":
    case "list-personas": {
      console.log("\nAvailable Personas:");
      console.log("");
      const ids = listPersonas().sort();
      for (const id of ids) {
        const persona = getPersona(id)!;
        const source = isBasePersona(id) ? "[base]" : "[custom]";
        console.log(`  ${source} ${id.padEnd(18)} - ${persona.name}`);
        console.log(`      ${persona.summary}`);
      }
      console.log("");
      break;
    }

    case "show": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }
      const source = isBasePersona(id) ? "base" : "custom";
      console.log(`\n${persona.name} (${id}) [${source}]\n`);
      console.log(`Summary: ${persona.summary}`);
      console.log(`\nCulture:`);
      console.log(`  Region: ${persona.culture.region || "N/A"}`);
      console.log(`  Subcultures: ${persona.culture.subcultures.join(", ")}`);
      console.log(`  Values: ${persona.culture.values.join(", ")}`);
      console.log(`\nInfluences:`);
      console.log(`  Films: ${persona.influences.films.join(", ")}`);
      console.log(`  Anime: ${persona.influences.anime.join(", ")}`);
      console.log(`  Music Genres: ${persona.influences.music.genres.join(", ")}`);
      console.log(`  Visual Artists: ${persona.influences.visualArtists.join(", ")}`);
      console.log(`  Spaces: ${persona.influences.spaces.join(", ")}`);
      console.log(`  Obsessions: ${persona.influences.obsessions.join(", ")}`);
      console.log(`\nAesthetic:`);
      console.log(`  Color: ${persona.aesthetic.colorTemperature} | Density: ${persona.aesthetic.density}`);
      console.log(`  Edge: ${persona.aesthetic.edgeStyle} | Motion: ${persona.aesthetic.motionStyle}`);
      console.log(`  Typography: ${persona.aesthetic.typographyStyle} | Texture: ${persona.aesthetic.textureStyle}`);
      console.log(`  Visual Keywords: ${persona.aesthetic.visualKeywords.join(", ")}`);
      console.log("");
      break;
    }

    case "generate": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const config = buildBasteConfig(options, fileConfig);

      if (options.dryrun) {
        console.log(`\nDry run for ${persona.name}`);
        const { generatePrompts } = await import("./generation/prompts.js");
        const prompts = generatePrompts(persona, {
          kind: "image",
          purpose: "hero",
          description: "Test asset",
        });
        console.log("Image Prompt:", prompts.image.prompt);
        break;
      }

      const suite = await generateAssetSuite(
        persona,
        fileConfig.assetTypes || [
          { kind: "svg", purpose: "icon", description: "App icon" },
          { kind: "image", purpose: "hero", description: "Hero banner", constraints: { aspectRatio: "21:9" } },
          { kind: "image", purpose: "background", description: "Ambient background", constraints: { aspectRatio: "16:9" } },
        ],
        config
      );

      const metaPath = `${config.generation.outputDir}/${id}-suite.json`;
      mkdirSync(dirname(metaPath), { recursive: true });
      writeFileSync(
        metaPath,
        JSON.stringify(
          {
            persona: { id: suite.persona.id, name: suite.persona.name },
            assets: {
              svgs: suite.assets.svgs.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
              images: suite.assets.images.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
              videos: suite.assets.videos.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose, path: a.content })),
            },
            metadata: suite.metadata,
          },
          null,
          2
        )
      );
      console.log(`\nMetadata saved to ${metaPath}`);
      break;
    }

    case "ui-kit": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const config = buildBasteConfig(options, fileConfig);
      const suite = await generateUIKit(persona, config);

      const metaPath = `${config.generation.outputDir}/${id}-ui-kit.json`;
      mkdirSync(dirname(metaPath), { recursive: true });
      writeFileSync(
        metaPath,
        JSON.stringify(
          {
            persona: { id: suite.persona.id, name: suite.persona.name },
            assets: {
              svgs: suite.assets.svgs.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
              images: suite.assets.images.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
              videos: suite.assets.videos.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
            },
            metadata: suite.metadata,
          },
          null,
          2
        )
      );
      console.log(`\nUI kit metadata saved to ${metaPath}`);
      break;
    }

    case "tokens": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const format = String(options.format || "css");
      const outputDir = String(options.outputdir || "./assets/output");
      const { exportCSS, exportTailwindConfig, generateDesignTokens } = await import("./assets/design-system.js");

      let output = "";
      let ext = "";

      switch (format) {
        case "css":
          output = exportCSS(persona);
          ext = "css";
          break;
        case "tailwind":
          output = exportTailwindConfig(persona);
          ext = "js";
          break;
        case "json":
          output = JSON.stringify(generateDesignTokens(persona), null, 2);
          ext = "json";
          break;
        default:
          console.error(`Unknown format: ${format}`);
          process.exit(1);
      }

      const outputPath = `${outputDir}/${id}-tokens.${ext}`;
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, output);
      console.log(`\nDesign tokens exported to ${outputPath} (${format})`);
      break;
    }

    case "create": {
      const draftId = String(options._positional || args[1]);
      if (!draftId) {
        console.error("Usage: baste create <id> [--name <name>] [--base <base-id>] [--from <file.json>]");
        process.exit(1);
      }

      let draft: PersonaDraft;

      // Load from JSON file if --from is provided
      if (options.from) {
        const fromPath = resolve(String(options.from));
        if (!existsSync(fromPath)) {
          console.error(`File not found: ${fromPath}`);
          process.exit(1);
        }
        try {
          const content = JSON.parse(readFileSync(fromPath, "utf-8"));
          draft = { ...content, id: draftId };
        } catch {
          console.error(`Invalid JSON in ${fromPath}`);
          process.exit(1);
        }
      } else {
        draft = {
          id: draftId,
          name: String(options.name || draftId),
          summary: options.summary ? String(options.summary) : undefined,
        };
      }

      // Extend from base persona if --base is provided
      let persona: import("./persona/types.js").Persona;
      if (options.base) {
        const baseId = String(options.base);
        const base = getPersona(baseId);
        if (!base) {
          console.error(`Base persona not found: ${baseId}`);
          console.log(`Available base personas: ${Object.keys(getBasePersonas()).join(", ")}`);
          process.exit(1);
        }
        persona = extendPersona(base, draft);
      } else {
        persona = buildPersona(draft);
      }

      savePersona(persona);
      console.log(`\nCreated persona: ${persona.id}`);
      console.log(`Name: ${persona.name}`);
      console.log(`Source: ${isBasePersona(persona.id) ? "base" : "custom"}`);
      console.log(`Saved to: ./personas/${persona.id}.json`);
      break;
    }

    case "delete": {
      const deleteId = String(options._positional || args[1]);
      if (!deleteId) {
        console.error("Usage: baste delete <persona-id>");
        process.exit(1);
      }
      const success = deletePersona(deleteId);
      if (!success) {
        console.error(`Cannot delete "${deleteId}" - either it's a base persona or doesn't exist.`);
        process.exit(1);
      }
      console.log(`Deleted persona: ${deleteId}`);
      break;
    }

    case "config": {
      const configPath = resolve("./baste.config.json");

      if (options.init) {
        const config: BasteUserConfig = {
          outputDir: "./assets/output",
          personaDir: "./personas",
          evaluator: { model: "gpt-4o" },
          qd: {
            features: defaultAssetFeatures,
            iterations: 5,
            batchSize: 3,
            mutationRate: 0.4,
            qualityThreshold: 0.5,
          },
          outputCount: 3,
        };
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Created ${configPath}`);
        break;
      }

      if (options.get) {
        const key = String(options.get);
        const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
        const value = key.split(".").reduce((obj: any, k) => obj?.[k], config);
        console.log(value !== undefined ? JSON.stringify(value, null, 2) : "undefined");
        break;
      }

      if (options.set) {
        const key = String(options.set);
        const value = options._positional2 !== undefined ? options._positional2 : true;
        let config: Record<string, unknown> = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
        const keys = key.split(".");
        let target: Record<string, unknown> = config;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!target[keys[i]] || typeof target[keys[i]] !== "object") {
            target[keys[i]] = {};
          }
          target = target[keys[i]] as Record<string, unknown>;
        }
        try {
          target[keys[keys.length - 1]] = JSON.parse(String(value));
        } catch {
          target[keys[keys.length - 1]] = value;
        }
        writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Set ${key} = ${value}`);
        break;
      }

      const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf-8")) : {};
      console.log(JSON.stringify(config, null, 2));
      break;
    }

    case "gui": {
      const port = parseInt(String(options.port || "3456"));
      await startGUIServer(port);
      console.log("Press Ctrl+C to stop.");
      // Keep process alive
      await new Promise(() => {});
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
