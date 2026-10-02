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
import { resolve, dirname, basename } from "node:path";
import {
  getPersona,
  listPersonas,
  isBasePersona,
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
  type BasteUserConfig,
} from "./config/baste-config.js";
import { startGUIServer } from "./gui/server.js";
import { DesignVersionRegistry } from "./versioning/registry.js";
import { slugifyUrl } from "./shared/url.js";
import { saveBrandKit, loadBrandKit } from "./decompose/store.js";

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
  baste decompose <url> [opts]              Decompose a live site into persona + brand kit
                                              --id, --name, --deep, --mirror-assets, --init
  baste remix <a> <b> --as <id>             Cross a persona with another into a new one
  baste delete <persona-id>                 Delete a custom persona
  baste config [options]                    Manage configuration
  baste gui [--port <n>]                    Start web GUI
  baste mcp [--stdio | --http]              Start MCP server (stdio or HTTP)
                                              --port <n>   Port for HTTP mode (default: 3457)
                                              --key <path> TLS private key (enables HTTPS)
                                              --cert <path> TLS certificate

Design Version Control:
  baste init <persona-id>                   Initialize design versioning
  baste history <persona-id> [--limit <n>]  Show design history
  baste status <persona-id>                 Show current state
  baste branches <persona-id>               List branches
  baste branch <persona-id> <name>          Create design branch
  baste switch <persona-id> <branch>        Switch active branch
  baste diff <v1> <v2>                      Diff two versions
  baste update <persona-id> <key> <val>     Update design token
  baste revert <persona-id> <version>       Revert to version
  baste culture <persona-id> [path...]      Add cultural references

Export/Share:
  baste export <persona-id> [path]          Export .baste file
  baste import <path>                       Import .baste file
  baste openpencil <persona-id> [path]      Export .pen for OpenPencil
  baste lint-palette <persona-id>           WCAG contrast check on persona's brand kit
                                              --against <#hex>    bg color to test against
                                              --min-ratio <n>     override 4.5 default

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
  baste init cyberbotanist                  Init version control
  baste history cyberbotanist               Show full history
  baste export cyberbotanist ./cyber.baste  Export for sharing
  baste culture cyberbotanist ~/Pictures/cultural/  Scan cultural refs
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
      const brandKit = loadBrandKit(id);

      let output = "";
      let ext = "";

      switch (format) {
        case "css":
          output = exportCSS(persona, brandKit);
          ext = "css";
          break;
        case "tailwind":
          output = exportTailwindConfig(persona, brandKit);
          ext = "js";
          break;
        case "json":
          output = JSON.stringify(generateDesignTokens(persona, brandKit), null, 2);
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

    case "decompose": {
      const url = String(options._positional || args[1] || "");
      if (!url || !/^https?:\/\//i.test(url)) {
        console.error("Usage: baste decompose <url> [--id <persona-id>] [--name <name>] [--deep] [--mirror-assets] [--init] [--output-dir <dir>]");
        process.exit(1);
      }
      const { decomposeUrl } = await import("./decompose/index.js");
      const slug = String(options.id || slugifyUrl(url));
      const outputDir = String(options.outputdir || "./personas");
      const deep = !!options.deep;
      const mirror = !!options.mirrorassets;
      const init = !!options.init;
      const saveAssetsDir = mirror ? String(options.assetsdir || "./assets/decomposed") : undefined;

      console.log(`\nDecomposing ${url} ${deep ? "(deep mode)" : ""} ...`);
      try {
        const { persona, brandKit } = await decomposeUrl(url, {
          id: slug,
          name: options.name ? String(options.name) : undefined,
          deep,
          saveAssetsDir,
          generatePaletteSwatch: mirror,
          timeoutMs: options.timeout ? parseInt(String(options.timeout)) : undefined,
        });

        savePersona(persona);
        const kitPath = saveBrandKit(slug, brandKit, outputDir);

        if (init) {
          const registry = new DesignVersionRegistry();
          registry.initPersona(persona);
          const sources: string[] = [];
          if (brandKit.logo) sources.push(brandKit.logo);
          if (brandKit.ogImage) sources.push(brandKit.ogImage);
          for (const img of brandKit.images.slice(0, 8)) sources.push(img.url);
          if (sources.length) {
            registry.scanCulturalImages(persona.id, sources, `Decomposed from ${brandKit.sourceUrl}`);
          }
          console.log(`Versioning initialized; ${sources.length} cultural refs added.`);
        }

        console.log(`\nCreated persona: ${persona.id} (${persona.name})`);
        console.log(`Brand kit saved to: ${kitPath}`);
        if (brandKit.localAssets) console.log(`Assets mirrored to: ${brandKit.localAssets.dir}`);
        console.log(`\nPalette roles:`);
        for (const [role, hex] of Object.entries(brandKit.paletteRoles)) {
          if (hex) console.log(`  ${role.padEnd(11)} ${hex}`);
        }
        console.log(`\nFonts: ${brandKit.fonts.join(", ") || "(none detected)"}`);
        if (brandKit.fontFaces.length) {
          console.log(`@font-face URLs: ${brandKit.fontFaces.filter((f) => f.src).length}`);
        }
        if (brandKit.logo) console.log(`Logo: ${brandKit.logo}`);
        if (brandKit.ogImage) console.log(`OG Image: ${brandKit.ogImage}`);
        console.log(`Images detected: ${brandKit.images.length}`);
        console.log(`Signals: edge≈${brandKit.signals.borderRadiusAvg.toFixed(1)}px, grid=${brandKit.signals.hasGrid}, fontCategory=${brandKit.signals.bodyFontCategory}`);
        console.log(`\nNext: baste show ${slug}  |  baste tokens ${slug} --format css  |  baste export ${slug}`);
      } catch (err) {
        console.error(`\nDecompose failed: ${err instanceof Error ? err.message : String(err)}`);
        process.exit(1);
      }
      break;
    }

    case "remix": {
      const a = String(options._positional || args[1] || "");
      const b = String(options._positional2 || args[2] || "");
      const newId = String(options.as || `${a}-${b}`);
      if (!a || !b) {
        console.error("Usage: baste remix <persona-a> <persona-b> [--as <new-id>] [--name <name>]");
        process.exit(1);
      }
      const pa = getPersona(a);
      const pb = getPersona(b);
      if (!pa || !pb) {
        console.error(`Unknown persona: ${pa ? b : a}`);
        process.exit(1);
      }
      const remix = extendPersona(pa, {
        id: newId,
        name: String(options.name || `${pa.name} × ${pb.name}`),
        summary: `Remix of ${pa.name} and ${pb.name}.`,
        culture: {
          subcultures: pb.culture.subcultures,
          values: pb.culture.values,
        },
        influences: {
          films: pb.influences.films,
          anime: pb.influences.anime,
          visualArtists: pb.influences.visualArtists,
          fashion: pb.influences.fashion,
          spaces: pb.influences.spaces,
          obsessions: pb.influences.obsessions,
        },
        aesthetic: {
          colorTemperature: pb.aesthetic.colorTemperature,
          density: pa.aesthetic.density,
          visualKeywords: pb.aesthetic.visualKeywords,
          moodKeywords: pa.aesthetic.moodKeywords,
        },
      });
      savePersona(remix);

      const ka = loadBrandKit(a);
      const kb = loadBrandKit(b);
      if (ka || kb) {
        const merged = {
          ...(kb || ka)!,
          sourceUrl: `remix:${a}+${b}`,
          fetchedAt: new Date().toISOString(),
          palette: [...new Set([...(ka?.palette ?? []), ...(kb?.palette ?? [])])].slice(0, 12),
          fonts: [...new Set([...(ka?.fonts ?? []), ...(kb?.fonts ?? [])])].slice(0, 8),
          paletteRoles: {
            ...(ka?.paletteRoles ?? {}),
            ...(kb?.paletteRoles ?? {}),
            primary: ka?.paletteRoles?.primary ?? kb?.paletteRoles?.primary,
            accent: kb?.paletteRoles?.accent ?? ka?.paletteRoles?.accent,
          },
        };
        saveBrandKit(newId, merged);
      }
      console.log(`Remixed: ${a} + ${b} → ${newId}`);
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

    case "mcp": {
      if (options.stdio) {
        const { runBasteMcpStdio } = await import("./mcp/server.js");
        await runBasteMcpStdio(fileConfig.personaDir ? { personaDir: fileConfig.personaDir } : undefined);
      } else {
        const { runBasteMcpHttp } = await import("./mcp/server.js");
        await runBasteMcpHttp({
          personaDir: fileConfig.personaDir,
          port: options.port ? parseInt(String(options.port)) : undefined,
          key: options.key ? String(options.key) : undefined,
          cert: options.cert ? String(options.cert) : undefined,
        });
        // Keep alive until SIGINT
        await new Promise(() => {});
      }
      break;
    }

    case "init": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry({ author: "baste-cli" });
      const result = registry.initPersona(persona);

      console.log(`\n✅ Initialized design versioning for: ${persona.name}`);
      console.log(`   Branch: ${result.branch.name} (${result.branch.id})`);
      console.log(`   Commit: ${result.version.commitId.slice(0, 7)}`);
      console.log(`   Component: ${result.component.name}`);
      console.log(`\nDesign tokens are now version controlled.`);
      console.log(`Use: baste history ${id}  to view the timeline.`);
      break;
    }

    case "history": {
      const id = String(options._positional || args[1]);
      const limit = parseInt(String(options.limit || "20"));
      const jsonOut = Boolean(options.json);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      if (jsonOut) {
        const data = registry.getPersonaHistory(id, limit);
        console.log(JSON.stringify(data, null, 2));
      } else {
        const log = registry.getHistoryLog(id, limit);
        console.log(log);
      }
      break;
    }

    case "status": {
      const id = String(options._positional || args[1]);
      const jsonOut = Boolean(options.json);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const active = registry.db.getActiveBranch(id);
      const components = registry.listComponents(id);
      const refs = registry.getCulturalRefs(id);
      const latest = registry.db.getLatestVersion(id);

      if (jsonOut) {
        console.log(JSON.stringify({ persona: { id, name: persona.name }, activeBranch: active ?? null, latestVersion: latest ?? null, components: components.length, culturalRefs: refs.length }, null, 2));
        break;
      }

      console.log(`\n📋 Status for ${persona.name} (${id})`);
      console.log(`   Active branch: ${active ? active.name : "none (not initialized)"}`);
      console.log(`   Latest commit: ${latest ? latest.commitId.slice(0, 7) + " — " + latest.message : "none"}`);
      console.log(`   Components: ${components.length}`);
      console.log(`   Cultural refs: ${refs.length}`);

      if (components.length > 0) {
        const c = components[0];
        console.log(`\n   Design tokens:`);
        console.log(`     Colors — Primary: ${c.tokens.colors.primary}  Background: ${c.tokens.colors.background}`);
        console.log(`     Typography — Heading: ${c.tokens.typography.fontFamily.heading.split(",")[0]}`);
        console.log(`     Motion — Style: ${c.tokens.motion.easing.default}`);
      }
      console.log("");
      break;
    }

    case "branches": {
      const id = String(options._positional || args[1]);
      const persona = getPersona(id);
      if (!persona) {
        console.error(`Unknown persona: ${id}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const active = registry.db.getActiveBranch(id);
      const branches = registry.listBranches(id);

      console.log(`\n🌿 Branches for ${persona.name}:`);
      console.log("");
      for (const b of branches) {
        const marker = active && b.id === active.id ? " * " : "   ";
        const defMarker = b.isDefault ? " [default]" : "";
        console.log(`${marker}${b.name}${defMarker}`);
        console.log(`     ${b.description || ""}`);
      }
      console.log("");
      break;
    }

    case "revert": {
      const personaId = String(options._positional || args[1]);
      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }

      const targetVersion = String(options._positional2 || args[2]);
      if (!targetVersion) {
        console.error("Usage: baste revert <persona-id> <version-id>");
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const components = registry.listComponents(personaId);
      if (components.length === 0) {
        // Auto-init
        registry.initPersona(persona);
      }

      const component = registry.listComponents(personaId)[0];
      if (!component) {
        console.error("No components found");
        process.exit(1);
      }

      const result = registry.revertToVersion(component.id, targetVersion);
      console.log(`\n↩️  Reverted ${component.name} to ${targetVersion.slice(0, 7)}`);
      console.log(`   New commit: ${result.revertVersion.commitId.slice(0, 7)} — ${result.revertVersion.message}`);
      break;
    }

    case "branch": {
      const personaId = String(options._positional || args[1]);
      const branchName = String(options._positional2 || args[2]);
      if (!branchName) {
        console.error("Usage: baste branch <persona-id> <branch-name>");
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const branch = registry.createBranch(personaId, branchName);
      console.log(`Created branch: ${branch.name} (${branch.id}) for ${personaId}`);
      break;
    }

    case "switch": {
      const personaId = String(options._positional || args[1]);
      const branchName = String(options._positional2 || args[2]);
      if (!branchName) {
        console.error("Usage: baste switch <persona-id> <branch-name>");
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const branch = registry.switchBranch(personaId, branchName);
      console.log(`Switched to branch: ${branch.name} (${branch.id})`);
      break;
    }

    case "diff": {
      const v1 = String(options._positional || args[1]);
      const v2 = String(options._positional2 || args[2]);
      if (!v1 || !v2) {
        console.error("Usage: baste diff <version-id-1> <version-id-2>");
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const diff = registry.diff(v1, v2);
      console.log(`\n${diff.summary}`);
      console.log("");
      if (diff.tokenDiffs.length > 0) {
        console.log("Token changes:");
        for (const td of diff.tokenDiffs) {
          console.log(`  ${td.tokenPath}: ${td.oldValue} → ${td.newValue}`);
        }
      } else {
        console.log("No token-level changes recorded (changes may be in other entities).");
      }
      console.log("");
      for (const ch of diff.changes) {
        console.log(`  [${ch.changeType}] ${ch.entityType}::${ch.entityId.slice(0, 7)}${ch.property ? ` :: ${ch.property}` : ""}${ch.newValue ? ` → ${ch.newValue}` : ""}`);
      }
      break;
    }

    case "update": {
      const personaId = String(options._positional || args[1]);
      const tokenPath = String(options._positional2 || args[2]);
      const newValue = String(args[3]); // Third positional
      if (!tokenPath || !newValue) {
        console.error("Usage: baste update <persona-id> <token.path> <new-value>");
        console.error("  e.g. baste update cyberbotanist colors.primary '#FF0000'");
        process.exit(1);
      }

      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const components = registry.listComponents(personaId);
      if (components.length === 0) {
        // Auto-init if not initialized
        registry.initPersona(persona);
      }

      const component = registry.listComponents(personaId)[0];
      if (!component) {
        console.error("No components found and auto-init failed");
        process.exit(1);
      }

      // Parse token path (e.g., "colors.primary" or "typography.fontFamily.heading")
      const path = tokenPath.split(".");
      const result = registry.updateComponentTokens(component.id, (tokens) => {
        let target: any = tokens;
        for (let i = 0; i < path.length - 1; i++) {
          if (!target[path[i]]) target[path[i]] = {};
          target = target[path[i]];
        }
        target[path[path.length - 1]] = newValue;
        return tokens;
      });

      console.log(`✅ Updated ${tokenPath} = ${newValue}`);
      console.log(`   Version: ${result.version.commitId.slice(0, 7)}`);
      console.log(`   Changes: ${result.changes.length}`);
      for (const ch of result.changes) {
        console.log(`   • ${ch.changeType}: ${ch.property}`);
      }
      break;
    }

    case "culture": {
      const personaId = String(options._positional || args[1]);
      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }

      // Collect remaining args as image paths
      const imagePaths: string[] = [];
      for (let i = 2; i < args.length; i++) {
        if (!args[i].startsWith("--")) {
          imagePaths.push(resolve(args[i]));
        }
      }

      const registry = new DesignVersionRegistry();

      if (imagePaths.length === 0) {
        // Just show current cultural refs
        const refs = registry.getCulturalRefs(personaId);
        console.log(`\n🎨 Cultural references for ${persona.name}:`);
        console.log("");
        for (const ref of refs) {
          console.log(`  [${ref.type}] ${ref.value}`);
          console.log(`      Why: ${ref.designRationale}`);
          if (ref.source) console.log(`      Source: ${ref.source}`);
          console.log("");
        }
        if (refs.length === 0) {
          console.log("  No cultural references recorded yet.");
          console.log("  Use: baste culture <persona> <image-path...>");
        }
        break;
      }

      // Add cultural refs from image paths
      let added = 0;
      for (const path of imagePaths) {
        if (existsSync(path)) {
          const stat = await import("node:fs").then((m) => m.statSync(path));
          if (stat.isDirectory()) {
            const files = await import("node:fs").then((m) => m.readdirSync(path));
            for (const file of files.filter((f: string) => /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f))) {
              registry.addCulturalReference(personaId, {
                type: "image",
                value: basename(file),
                designRationale: `Cultural reference from image library`,
                source: resolve(path, file),
              });
              added++;
            }
          } else {
            registry.addCulturalReference(personaId, {
              type: "image",
              value: basename(path),
              designRationale: `Cultural reference image`,
              source: path,
            });
            added++;
          }
        } else {
          console.warn(`Path not found: ${path}`);
        }
      }

      console.log(`✅ Added ${added} cultural reference(s) to ${persona.name}`);
      break;
    }

    case "export": {
      const personaId = String(options._positional || args[1]);
      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }

      const outputDir = String(options.outputdir || fileConfig.outputDir || "./assets/output");
      const defaultPath = `${outputDir}/${personaId}.baste`;
      const outputPath = String(args[2] || defaultPath);
      mkdirSync(dirname(outputPath), { recursive: true });

      const registry = new DesignVersionRegistry();
      registry.exportToFile(personaId, outputPath);
      console.log(`\n📦 Exported design system to ${outputPath}`);
      console.log(`   Persona: ${persona.name}`);
      console.log(`   Format: .baste (sharable)`);
      break;
    }

    case "import": {
      const importPath = String(options._positional || args[1]);
      if (!importPath) {
        console.error("Usage: baste import <path-to-file.baste>");
        process.exit(1);
      }
      if (!existsSync(importPath)) {
        console.error(`File not found: ${importPath}`);
        process.exit(1);
      }

      const registry = new DesignVersionRegistry();
      const result = registry.importFromFile(importPath);

      console.log(`\n📥 Imported design system from ${importPath}`);
      console.log(`   Persona ID: ${result.personaId}`);
      console.log(`   Components: ${result.componentsImported}`);
      console.log(`   Versions: ${result.versionsImported}`);
      console.log(`   Cultural refs: ${result.refsImported}`);
      break;
    }

    case "openpencil": {
      const personaId = String(options._positional || args[1]);
      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }

      const outputDir = String(options.outputdir || fileConfig.outputDir || "./assets/output");
      const defaultPath = `${outputDir}/${personaId}.pen`;
      const outputPath = String(args[2] || defaultPath);
      mkdirSync(dirname(outputPath), { recursive: true });

      const registry = new DesignVersionRegistry();
      const result = await registry.exportToOpenPencilFile(persona, outputPath);
      console.log(`\n🎨 Exported OpenPencil document to ${result.path}`);
      console.log(`   Persona: ${persona.name}`);
      console.log(`   Open in OpenPencil to edit design tokens and cultural board`);
      break;
    }

    case "lint-palette": {
      const personaId = String(options._positional || args[1]);
      const persona = getPersona(personaId);
      if (!persona) {
        console.error(`Unknown persona: ${personaId}`);
        process.exit(1);
      }
      const { lintPalette, contrastRatio, parseColor } = await import("./assets/contrast.js");
      const { loadBrandKit } = await import("./decompose/store.js");
      const kit = loadBrandKit(personaId);
      if (!kit) {
        console.error(`No brand kit for ${personaId}. Run "baste decompose <url> --id ${personaId}" first.`);
        process.exit(1);
      }
      const palette = kit.palette;
      const against = options.against ? String(options.against) : undefined;
      const minRatio = options.minratio ? Number(options.minratio) : 4.5;
      const issues = lintPalette(palette, { minRatio, against });

      console.log(`\nPalette lint — ${persona.name} (${personaId})`);
      console.log(`  Colors:    ${palette.length}`);
      console.log(`  Against:   ${against ?? "(lightest in palette)"}`);
      console.log(`  Threshold: ${minRatio}:1 (WCAG AA body text)`);
      console.log("");
      // Show every pairwise ratio so the user can read it.
      const parsed = palette.map((c) => ({ c, rgb: parseColor(c) })).filter((x) => x.rgb);
      const bg = against
        ? { c: against, rgb: parseColor(against) }
        : parsed.slice().sort((a, b) => (b.rgb!.r + b.rgb!.g + b.rgb!.b) - (a.rgb!.r + a.rgb!.g + a.rgb!.b))[0];
      if (bg?.rgb) {
        console.log(`  Ratios (foreground on ${bg.c}):`);
        for (const fg of parsed) {
          if (fg.c === bg.c) continue;
          const r = contrastRatio(fg.rgb!, bg.rgb!);
          const tag = r >= 7 ? "AAA" : r >= 4.5 ? "AA " : r >= 3 ? "A+ " : "FAIL";
          console.log(`    ${fg.c.padEnd(8)} → ${r.toFixed(2).padStart(5)}:1  ${tag}`);
        }
      }
      console.log("");
      if (issues.length === 0) {
        console.log(`  ✓ All colors pass ${minRatio}:1 against ${bg?.c ?? against}.`);
        process.exit(0);
      }
      console.log(`  ✗ ${issues.length} pair(s) below ${minRatio}:1:`);
      for (const i of issues) {
        console.log(`    ${i.pair[0]} on ${i.pair[1]}  ${i.ratio}:1  (${i.level})`);
      }
      process.exit(2);
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
