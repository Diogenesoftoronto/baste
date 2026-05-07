import type { FlueContext } from "@flue/sdk/client";
import * as v from "valibot";
import {
  getPersona,
  listPersonas,
  savePersona,
  deletePersona,
  initStore,
  isBasePersona,
} from "../../src/persona/store.js";
import { buildPersona, extendPersona } from "../../src/persona/builder.js";
import { generateAssetSuite, generateUIKit } from "../../src/baste.js";
import { defaultAssetFeatures } from "../../src/generation/qd.js";
import { resolveConfig, toBasteConfig } from "../../src/config/baste-config.js";

export const triggers = { webhook: true };

export default async function ({ init, payload }: FlueContext) {
  const agent = await init({ model: "anthropic/claude-sonnet-4" });
  const session = await agent.session();

  // Initialize store
  initStore();

  const requestSchema = v.object({
    action: v.picklist([
      "generate", "ui-kit", "list", "show",
      "create", "delete", "update", "config",
    ]),
    personaId: v.optional(v.string()),
    persona: v.optional(v.object({ id: v.string(), name: v.string() })),
    options: v.optional(v.object({
      outputDir: v.optional(v.string()),
      iterations: v.optional(v.number()),
      batchSize: v.optional(v.number()),
      outputCount: v.optional(v.number()),
      model: v.optional(v.string()),
    })),
  });

  const request = v.parse(requestSchema, payload);
  const fileConfig = resolveConfig();

  switch (request.action) {
    case "list": {
      const ids = listPersonas();
      const personas = ids.map((id) => {
        const p = getPersona(id)!;
        return {
          id,
          name: p.name,
          summary: p.summary,
          source: isBasePersona(id) ? "base" : "custom",
          aesthetic: {
            colorTemperature: p.aesthetic.colorTemperature,
            density: p.aesthetic.density,
          },
        };
      });
      return { personas };
    }

    case "show": {
      if (!request.personaId) {
        return { error: "personaId required" };
      }
      const persona = getPersona(request.personaId);
      if (!persona) {
        return { error: `Unknown persona: ${request.personaId}` };
      }
      return {
        persona: {
          ...persona,
          source: isBasePersona(request.personaId) ? "base" : "custom",
        },
      };
    }

    case "create": {
      const draft = request.persona;
      if (!draft) {
        return { error: "persona is required" };
      }
      const persona = buildPersona(draft as unknown as import("../../src/persona/builder.js").PersonaDraft);
      savePersona(persona);
      return { success: true, id: persona.id, persona: { id: persona.id, name: persona.name } };
    }

    case "update": {
      if (!request.personaId) {
        return { error: "personaId required" };
      }
      const existing = getPersona(request.personaId);
      if (!existing) {
        return { error: `Unknown persona: ${request.personaId}` };
      }
      if (isBasePersona(request.personaId)) {
        return { error: "Cannot modify base personas" };
      }
      const updated = { ...existing, ...request.persona, id: request.personaId } as unknown as import("../../src/persona/types.js").Persona;
      savePersona(updated);
      return { success: true, id: request.personaId };
    }

    case "delete": {
      if (!request.personaId) {
        return { error: "personaId required" };
      }
      const success = deletePersona(request.personaId);
      if (!success) {
        return { error: "Cannot delete base persona or not found" };
      }
      return { success: true };
    }

    case "generate": {
      if (!request.personaId) {
        return { error: "personaId required" };
      }
      const persona = getPersona(request.personaId);
      if (!persona) {
        return { error: `Unknown persona: ${request.personaId}` };
      }

      const opts = request.options || {};
      const config = toBasteConfig(fileConfig);

      const suite = await generateAssetSuite(
        persona,
        fileConfig.assetTypes || [
          { kind: "svg", purpose: "icon", description: "App icon" },
          { kind: "image", purpose: "hero", description: "Hero banner", constraints: { aspectRatio: "21:9" } },
          { kind: "image", purpose: "background", description: "Ambient background", constraints: { aspectRatio: "16:9" } },
        ],
        {
          generation: { outputDir: opts.outputDir || config.generation.outputDir },
          qd: {
            features: config.qd.features,
            iterations: opts.iterations || config.qd.iterations,
            batchSize: opts.batchSize || config.qd.batchSize,
            mutationRate: config.qd.mutationRate,
            qualityThreshold: config.qd.qualityThreshold,
          },
          outputCount: opts.outputCount || config.outputCount,
          evaluator: { model: opts.model || config.evaluator.model },
        }
      );

      return {
        persona: persona.id,
        assets: {
          svgs: suite.assets.svgs.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
          images: suite.assets.images.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
          videos: suite.assets.videos.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
        },
        metadata: suite.metadata,
      };
    }

    case "ui-kit": {
      if (!request.personaId) {
        return { error: "personaId required" };
      }
      const persona = getPersona(request.personaId);
      if (!persona) {
        return { error: `Unknown persona: ${request.personaId}` };
      }

      const opts = request.options || {};
      const config = toBasteConfig(fileConfig);

      const suite = await generateUIKit(persona, {
        generation: { outputDir: opts.outputDir || config.generation.outputDir },
        qd: {
          features: config.qd.features,
          iterations: opts.iterations || config.qd.iterations,
          batchSize: opts.batchSize || config.qd.batchSize,
          mutationRate: config.qd.mutationRate,
          qualityThreshold: config.qd.qualityThreshold,
        },
        outputCount: opts.outputCount || config.outputCount,
        evaluator: { model: opts.model || config.evaluator.model },
      });

      return {
        persona: persona.id,
        assets: {
          svgs: suite.assets.svgs.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
          images: suite.assets.images.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
          videos: suite.assets.videos.map((a) => ({ id: a.id, purpose: a.metadata.assetPurpose })),
        },
        metadata: suite.metadata,
      };
    }

    case "config": {
      return { config: fileConfig };
    }

    default:
      return { error: "Unknown action" };
  }
}
