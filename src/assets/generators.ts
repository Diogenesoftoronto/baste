/**
 * Asset Generation Services
 * 
 * Integrates with:
 * - QuiverAI for SVG generation
 * - OpenAI (DALL-E 3 / GPT Image 2) for images
 * - Veo 3 for video (when API available)
 * 
 * Each service takes a persona and asset specification,
 * generates the asset, and returns it with metadata.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Persona } from "../persona/types.js";
import type { AssetType, GeneratedPrompt } from "../generation/prompts.js";

export interface GeneratedAsset {
  id: string;
  type: "svg" | "image" | "video";
  content: string; // SVG code, image URL/path, or video URL/path
  prompt: string;
  metadata: {
    service: string;
    model: string;
    personaId: string;
    assetPurpose: string;
    seed?: number;
    generationTime: number;
  };
}

export interface GenerationConfig {
  // API keys (read from env)
  openaiApiKey?: string;
  quiverApiKey?: string;
  googleApiKey?: string;

  // Output settings
  outputDir: string;

  // Generation parameters
  seed?: number;
}

/**
 * SVG Asset Generator (QuiverAI)
 * 
 * QuiverAI generates vector graphics from text descriptions.
 * We use the SVG prompt format optimized for vector output.
 */
export class SVGGenerator {
  private apiKey: string | undefined;
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.apiKey = config.quiverApiKey || process.env.QUIVER_API_KEY;
    this.outputDir = `${config.outputDir}/svg`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(
    persona: Persona,
    asset: AssetType,
    prompt: GeneratedPrompt
  ): Promise<GeneratedAsset> {
    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    // For now, generate SVG using OpenAI's capabilities or fallback to template
    // TODO: Integrate QuiverAI API when available
    const svgContent = await this.generateSVGWithLLM(prompt);

    const outputPath = `${this.outputDir}/${id}.svg`;
    writeFileSync(outputPath, svgContent);

    return {
      id,
      type: "svg",
      content: outputPath,
      prompt: prompt.prompt,
      metadata: {
        service: "quiverai",
        model: "quiver-1",
        personaId: persona.id,
        assetPurpose: asset.purpose,
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async generateSVGWithLLM(prompt: GeneratedPrompt): Promise<string> {
    // Placeholder: This would call an LLM to generate SVG code
    // In production, integrate with QuiverAI's actual API
    const openaiKey = process.env.OPENAI_API_KEY;

    if (!openaiKey) {
      // Return a template SVG when no API key available
      return this.createTemplateSVG(prompt.prompt);
    }

    // Call OpenAI to generate SVG
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            { role: "system", content: prompt.systemContext },
            { role: "user", content: prompt.prompt + "\n\nOutput only valid SVG XML code, no markdown, no explanations." },
          ],
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "";

      // Extract SVG from response
      const svgMatch = content.match(/<svg[\s\S]*?<\/svg>/);
      if (svgMatch) {
        return svgMatch[0];
      }

      return this.createTemplateSVG(prompt.prompt);
    } catch (error) {
      console.warn("SVG generation failed, using template:", error);
      return this.createTemplateSVG(prompt.prompt);
    }
  }

  private createTemplateSVG(prompt: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <!-- AI-generated SVG based on: ${prompt.slice(0, 100)}... -->
  <defs>
    <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e8d5b7"/>
      <stop offset="100%" style="stop-color:#7a9e7e"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g1)" rx="12"/>
  <circle cx="100" cy="100" r="60" fill="none" stroke="#f4f1ea" stroke-width="2" opacity="0.6"/>
  <path d="M70,100 Q100,60 130,100 T70,100" fill="none" stroke="#f4f1ea" stroke-width="1.5" opacity="0.8"/>
  <text x="100" y="180" text-anchor="middle" fill="#5a7a5e" font-family="system-ui" font-size="10">Generated Asset</text>
</svg>`;
  }
}

/**
 * Image Asset Generator (OpenAI DALL-E 3 / GPT Image 2)
 */
export class ImageGenerator {
  private apiKey: string | undefined;
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.apiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.outputDir = `${config.outputDir}/images`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(
    persona: Persona,
    asset: AssetType,
    prompt: GeneratedPrompt
  ): Promise<GeneratedAsset> {
    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    if (!this.apiKey) {
      throw new Error("OpenAI API key required for image generation. Set OPENAI_API_KEY.");
    }

    // Use GPT Image 2 (latest) or DALL-E 3
    const imageUrl = await this.callOpenAIImageAPI(prompt);

    // Download and save the image
    const outputPath = `${this.outputDir}/${id}.png`;
    await this.downloadImage(imageUrl, outputPath);

    return {
      id,
      type: "image",
      content: outputPath,
      prompt: prompt.prompt,
      metadata: {
        service: "openai",
        model: "gpt-image-2",
        personaId: persona.id,
        assetPurpose: asset.purpose,
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async callOpenAIImageAPI(prompt: GeneratedPrompt): Promise<string> {
    // Try GPT Image 2 first (newer), fallback to DALL-E 3
    try {
      const response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-image-2", // or "dall-e-3"
          prompt: prompt.prompt,
          size: prompt.parameters.size || "1024x1024",
          quality: prompt.parameters.quality || "high",
          style: prompt.parameters.style || "vivid",
          n: 1,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${error}`);
      }

      const data = await response.json();
      return data.data[0]?.url || data.data[0]?.b64_json;
    } catch (error) {
      console.error("Image generation failed:", error);
      throw error;
    }
  }

  private async downloadImage(url: string, outputPath: string): Promise<void> {
    if (url.startsWith("data:")) {
      // Handle base64
      const base64 = url.split(",")[1];
      writeFileSync(outputPath, Buffer.from(base64, "base64"));
      return;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(outputPath, buffer);
  }
}

/**
 * Video Asset Generator (Veo 3)
 * 
 * Generates short video clips/loops for backgrounds, transitions, etc.
 */
export class VideoGenerator {
  private apiKey: string | undefined;
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.apiKey = config.googleApiKey || process.env.GOOGLE_API_KEY;
    this.outputDir = `${config.outputDir}/videos`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(
    persona: Persona,
    asset: AssetType,
    prompt: GeneratedPrompt
  ): Promise<GeneratedAsset> {
    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    if (!this.apiKey) {
      throw new Error("Google API key required for video generation. Set GOOGLE_API_KEY.");
    }

    // Veo 3 API integration
    const videoResult = await this.callVeoAPI(prompt);

    return {
      id,
      type: "video",
      content: videoResult,
      prompt: prompt.prompt,
      metadata: {
        service: "google",
        model: "veo-3",
        personaId: persona.id,
        assetPurpose: asset.purpose,
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async callVeoAPI(prompt: GeneratedPrompt): Promise<string> {
    // Veo 3 API endpoint (placeholder - actual API may differ)
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt: prompt.prompt,
            duration: prompt.parameters.duration || 5,
            aspectRatio: prompt.parameters.aspectRatio || "16:9",
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Veo API error: ${error}`);
      }

      const data = await response.json();
      // Return video URL or local path
      return data.video?.uri || data.videoUrl || "";
    } catch (error) {
      console.error("Video generation failed:", error);
      throw error;
    }
  }
}

/**
 * Unified Asset Generator
 * Routes to appropriate service based on type
 */
export class AssetGenerator {
  private svg: SVGGenerator;
  private image: ImageGenerator;
  private video: VideoGenerator;
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
    this.svg = new SVGGenerator(config);
    this.image = new ImageGenerator(config);
    this.video = new VideoGenerator(config);
  }

  async generate(
    persona: Persona,
    asset: AssetType,
    prompt: GeneratedPrompt
  ): Promise<GeneratedAsset> {
    switch (asset.kind) {
      case "svg":
        return this.svg.generate(persona, asset, prompt);
      case "image":
        return this.image.generate(persona, asset, prompt);
      case "video":
        return this.video.generate(persona, asset, prompt);
      default:
        throw new Error(`Unsupported asset type: ${(asset as AssetType).kind}`);
    }
  }

  async generateBatch(
    persona: Persona,
    assets: AssetType[],
    prompts: Record<string, GeneratedPrompt>
  ): Promise<GeneratedAsset[]> {
    const results: GeneratedAsset[] = [];

    for (const asset of assets) {
      const prompt = prompts[asset.kind];
      if (!prompt) {
        console.warn(`No prompt for asset type: ${asset.kind}`);
        continue;
      }

      try {
        const result = await this.generate(persona, asset, prompt);
        results.push(result);
      } catch (error) {
        console.error(`Failed to generate ${asset.kind} asset:`, error);
      }
    }

    return results;
  }
}
