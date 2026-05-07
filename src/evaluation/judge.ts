/**
 * LLM-as-a-Judge Evaluation System
 * 
 * Uses an LLM agent to evaluate generated assets against persona criteria.
 * This is critical for the QD loop - we need automated quality assessment
 * that understands aesthetic alignment.
 */

import type { Persona } from "../persona/types.js";

export interface EvaluationCriteria {
  personaAlignment: number; // 0-1: how well does it match the persona
  visualQuality: number;    // 0-1: technical visual quality
  uniqueness: number;       // 0-1: how distinct is it from generic outputs
  coherence: number;        // 0-1: how cohesive is the design
  usability: number;        // 0-1: can it be used in a real UI
}

export interface EvaluationResult {
  // Overall score (weighted average)
  overall: number;

  // Individual criteria scores
  criteria: EvaluationCriteria;

  // Feature values for QD positioning
  features: number[];

  // Qualitative feedback
  feedback: string;

  // Suggested improvements
  improvements: string[];

  // Tags extracted from evaluation
  tags: string[];
}

export interface EvaluateOptions {
  // Type of asset being evaluated
  assetType: "svg" | "image" | "video";

  // Optional: actual content/asset data for analysis
  content?: string;

  // Optional: generation prompt used
  prompt?: string;
}

/**
 * Build evaluation prompt for LLM judge
 */
export function buildEvaluationPrompt(
  persona: Persona,
  options: EvaluateOptions
): { system: string; user: string } {
  const system = `You are an expert design critic and cultural analyst specializing in ${persona.culture.subcultures[0]} aesthetics.

Your job is to evaluate generated assets against a specific persona's taste profile. You understand:
- The visual language of ${persona.influences.films.slice(0, 3).join(", ")}
- The aesthetic sensibilities of ${persona.aesthetic.visualKeywords.slice(0, 4).join(", ")}
- The values of ${persona.culture.values.slice(0, 3).join(", ")}

You are rigorous but fair. $${persona.name} would reject generic, mass-produced looking work. They appreciate:
${persona.behaviors.interfaceValues.map((v) => `- ${v}`).join("\n")}

Rate assets on a 0.0-1.0 scale. Be precise with decimals. Only exceptional work that would genuinely delight ${persona.name} should score above 0.85.`;

  const user = `Evaluate this ${options.assetType} asset for ${persona.name}.

## Persona Profile
${persona.summary}

**Cultural Anchors:** ${persona.culture.subcultures.join(", ")}
**Core Values:** ${persona.culture.values.join(", ")}
**Visual DNA:** ${persona.aesthetic.visualKeywords.join(", ")}
**Mood Keywords:** ${persona.aesthetic.moodKeywords.join(", ")}
**Aesthetic Profile:**
- Color Temperature: ${persona.aesthetic.colorTemperature}
- Density: ${persona.aesthetic.density}
- Edge Style: ${persona.aesthetic.edgeStyle}
- Motion Style: ${persona.aesthetic.motionStyle}
- Texture: ${persona.aesthetic.textureStyle}
- Typography: ${persona.aesthetic.typographyStyle}
- Layout: ${persona.aesthetic.layoutStyle}

**What they love:** ${persona.influences.films.slice(0, 3).join(", ")}, ${persona.influences.anime.slice(0, 2).join(", ")}, ${persona.influences.visualArtists.slice(0, 2).join(", ")}

**What annoys them:** ${persona.behaviors.petPeeves.slice(0, 3).join(", ")}

## Asset to Evaluate
Type: ${options.assetType}
${options.prompt ? `\nGeneration Prompt:\n${options.prompt}` : ""}
${options.content ? `\nAsset Content:\n${options.content.slice(0, 2000)}` : ""}

## Evaluation Instructions

Score each criterion from 0.0 to 1.0:

1. **personaAlignment** (0-1): Does this feel like it was made FOR ${persona.name}? Would they immediately recognize it as something that understands their world? Check against their visual DNA and cultural references.

2. **visualQuality** (0-1): Is this technically well-executed? Good composition, color harmony, appropriate detail level, professional finish.

3. **uniqueness** (0-1): How distinct is this from generic ${options.assetType} outputs? Does it have a point of view? Would it stand out in a feed of similar assets?

4. **coherence** (0-1): Do all elements work together? Is the style consistent? Does it feel like one unified vision rather than random elements mashed together?

5. **usability** (0-1): Can this actually be used in a real application? Is it the right format, size, complexity? Would it work at different scales?

Also provide:
- **features**: Array of 3 numbers [colorTemp, density, abstractness] where:
  - colorTemp: -1 (cool) to 1 (warm)
  - density: 0 (sparse) to 1 (dense)  
  - abstractness: 0 (literal) to 1 (abstract)
- **feedback**: 2-3 sentences of specific qualitative assessment
- **improvements**: Array of 2-3 specific suggestions
- **tags**: Array of 5 descriptive tags

Output ONLY a JSON object in this exact format:
{
  "overall": 0.0,
  "criteria": {
    "personaAlignment": 0.0,
    "visualQuality": 0.0,
    "uniqueness": 0.0,
    "coherence": 0.0,
    "usability": 0.0
  },
  "features": [0.0, 0.0, 0.0],
  "feedback": "",
  "improvements": ["", ""],
  "tags": ["", "", "", "", ""]
}`;

  return { system, user };
}

/**
 * Parse LLM evaluation response
 */
export function parseEvaluation(response: string): EvaluationResult {
  try {
    // Extract JSON from response (in case there's markdown or text around it)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in evaluation response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!parsed.criteria || typeof parsed.overall !== "number") {
      throw new Error("Invalid evaluation structure");
    }

    // Calculate overall if not provided or normalize
    const overall =
      parsed.overall ||
      (parsed.criteria.personaAlignment * 0.3 +
        parsed.criteria.visualQuality * 0.2 +
        parsed.criteria.uniqueness * 0.2 +
        parsed.criteria.coherence * 0.15 +
        parsed.criteria.usability * 0.15);

    return {
      overall: Math.min(1, Math.max(0, overall)),
      criteria: {
        personaAlignment: Math.min(1, Math.max(0, parsed.criteria.personaAlignment)),
        visualQuality: Math.min(1, Math.max(0, parsed.criteria.visualQuality)),
        uniqueness: Math.min(1, Math.max(0, parsed.criteria.uniqueness)),
        coherence: Math.min(1, Math.max(0, parsed.criteria.coherence)),
        usability: Math.min(1, Math.max(0, parsed.criteria.usability)),
      },
      features: (parsed.features || [0, 0, 0]).map((f: number) =>
        Math.min(1, Math.max(-1, f))
      ),
      feedback: parsed.feedback || "",
      improvements: parsed.improvements || [],
      tags: parsed.tags || [],
    };
  } catch (error) {
    // Fallback evaluation
    console.warn("Failed to parse evaluation, using fallback:", error);
    return {
      overall: 0.5,
      criteria: {
        personaAlignment: 0.5,
        visualQuality: 0.5,
        uniqueness: 0.5,
        coherence: 0.5,
        usability: 0.5,
      },
      features: [0, 0.5, 0.5],
      feedback: "Parse error - manual review needed",
      improvements: ["Re-generate with clearer prompt"],
      tags: ["review-needed"],
    };
  }
}

/**
 * Evaluate a batch of assets
 */
export async function evaluateBatch(
  persona: Persona,
  assets: Array<{ type: "svg" | "image" | "video"; prompt: string; content?: string }>,
  evaluateFn: (system: string, user: string) => Promise<string>
): Promise<EvaluationResult[]> {
  const evaluations: EvaluationResult[] = [];

  for (const asset of assets) {
    const { system, user } = buildEvaluationPrompt(persona, {
      assetType: asset.type,
      prompt: asset.prompt,
      content: asset.content,
    });

    try {
      const response = await evaluateFn(system, user);
      const result = parseEvaluation(response);
      evaluations.push(result);
    } catch (error) {
      console.error("Evaluation failed for asset:", error);
      evaluations.push({
        overall: 0.3,
        criteria: {
          personaAlignment: 0.3,
          visualQuality: 0.3,
          uniqueness: 0.3,
          coherence: 0.3,
          usability: 0.3,
        },
        features: [0, 0.5, 0.5],
        feedback: "Evaluation failed",
        improvements: ["Retry evaluation"],
        tags: ["failed"],
      });
    }
  }

  return evaluations;
}

/**
 * Create a weighted scoring function for QD integration
 */
export function createScorer(
  weights: Partial<EvaluationCriteria> = {}
): (result: EvaluationResult) => number {
  const defaultWeights: EvaluationCriteria = {
    personaAlignment: 0.3,
    visualQuality: 0.2,
    uniqueness: 0.2,
    coherence: 0.15,
    usability: 0.15,
  };

  const w = { ...defaultWeights, ...weights };

  return (result: EvaluationResult) => {
    return (
      result.criteria.personaAlignment * w.personaAlignment +
      result.criteria.visualQuality * w.visualQuality +
      result.criteria.uniqueness * w.uniqueness +
      result.criteria.coherence * w.coherence +
      result.criteria.usability * w.usability
    );
  };
}
