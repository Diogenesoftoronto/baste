/**
 * Asset Generation Services
 *
 * SVG: QuiverAI only — no fallback. Requires QUIVER_API_KEY.
 * Image: OpenAI (gpt-image-2 / dall-e-3) or Google Gemini (Imagen 3 / Gemini Flash).
 * Video: Veo 3 via Google API.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import type { Persona } from "../persona/types.js";
import type { AssetType, GeneratedPrompt } from "../generation/prompts.js";

export interface GeneratedAsset {
  id: string;
  type: "svg" | "image" | "video";
  content: string;
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
  openaiApiKey?: string;
  quiverApiKey?: string;
  quiverBaseUrl?: string;
  googleApiKey?: string;
  outputDir: string;
  imageProvider?: "openai" | "gemini";
  imageModel?: string;
  imageSize?: string;
  imageQuality?: "standard" | "high";
  imageStyle?: "vivid" | "natural";
}

// ── QuiverAI SVG Generator ────────────────────────────────────────────────────

export class SVGGenerator {
  private apiKey: string | undefined;
  private baseUrl: string;
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.apiKey = config.quiverApiKey || process.env.QUIVER_API_KEY;
    this.baseUrl = config.quiverBaseUrl || process.env.QUIVER_BASE_URL || "https://api.quiverai.com";
    this.outputDir = `${config.outputDir}/svg`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(persona: Persona, asset: AssetType, prompt: GeneratedPrompt): Promise<GeneratedAsset> {
    if (!this.apiKey) {
      throw new Error(
        "QuiverAI API key required for SVG generation. Set QUIVER_API_KEY environment variable or configure generators.svg.apiKey in baste.config.json."
      );
    }

    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    const svgContent = await this.callQuiverAPI(prompt);

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

  private async callQuiverAPI(prompt: GeneratedPrompt): Promise<string> {
    const response = await fetch(`${this.baseUrl}/v1/svg/generate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: prompt.prompt,
        style: prompt.systemContext,
        format: "svg",
        parameters: prompt.parameters,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`QuiverAI API error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();

    // QuiverAI returns SVG either as `svg`, `content`, or `data.svg`
    const svgContent: string = data.svg ?? data.content ?? data.data?.svg ?? "";
    if (!svgContent || !svgContent.includes("<svg")) {
      throw new Error("QuiverAI returned an empty or invalid SVG response.");
    }
    return svgContent;
  }
}

// ── Image Generator (OpenAI or Gemini) ───────────────────────────────────────

export class ImageGenerator {
  private openaiKey: string | undefined;
  private googleKey: string | undefined;
  private provider: "openai" | "gemini";
  private model: string;
  private size: string;
  private quality: "standard" | "high";
  private style: "vivid" | "natural";
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.googleKey = config.googleApiKey || process.env.GOOGLE_API_KEY;
    this.provider = config.imageProvider ?? "openai";
    this.model = config.imageModel ?? (this.provider === "gemini" ? "imagen-3.0-generate-002" : "gpt-image-2");
    this.size = config.imageSize ?? "1024x1024";
    this.quality = config.imageQuality ?? "high";
    this.style = config.imageStyle ?? "vivid";
    this.outputDir = `${config.outputDir}/images`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(persona: Persona, asset: AssetType, prompt: GeneratedPrompt): Promise<GeneratedAsset> {
    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    let outputPath: string;
    let service: string;

    if (this.provider === "gemini") {
      if (!this.googleKey) {
        throw new Error(
          "Google API key required for Gemini image generation. Set GOOGLE_API_KEY environment variable or configure generators.image.apiKey."
        );
      }
      outputPath = `${this.outputDir}/${id}.png`;
      await this.generateGemini(prompt, outputPath);
      service = "google";
    } else {
      if (!this.openaiKey) {
        throw new Error(
          "OpenAI API key required for image generation. Set OPENAI_API_KEY environment variable or configure generators.image.apiKey."
        );
      }
      outputPath = `${this.outputDir}/${id}.png`;
      await this.generateOpenAI(prompt, outputPath);
      service = "openai";
    }

    return {
      id,
      type: "image",
      content: outputPath,
      prompt: prompt.prompt,
      metadata: {
        service,
        model: this.model,
        personaId: persona.id,
        assetPurpose: asset.purpose,
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async generateOpenAI(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt.prompt,
        size: prompt.parameters?.size || this.size,
        quality: this.quality,
        style: this.style,
        n: 1,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OpenAI image API error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    const result = data.data?.[0];
    if (!result) throw new Error("OpenAI returned no image data.");

    if (result.b64_json) {
      writeFileSync(outputPath, Buffer.from(result.b64_json, "base64"));
    } else if (result.url) {
      await this.downloadToFile(result.url, outputPath);
    } else {
      throw new Error("OpenAI returned neither b64_json nor url.");
    }
  }

  private async generateGemini(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    // Supports both Imagen 3 (imagen-3.0-generate-002) and
    // Gemini 2.0 Flash Preview image generation
    const isGeminiFlash = this.model.startsWith("gemini-");

    if (isGeminiFlash) {
      await this.generateGeminiFlash(prompt, outputPath);
    } else {
      await this.generateImagen(prompt, outputPath);
    }
  }

  private async generateImagen(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:predict?key=${this.googleKey}`;

    const aspectRatio = prompt.parameters?.aspectRatio ?? "1:1";
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: prompt.prompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Imagen API error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error("Imagen returned no image data.");
    }
    writeFileSync(outputPath, Buffer.from(prediction.bytesBase64Encoded, "base64"));
  }

  private async generateGeminiFlash(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.googleKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt.prompt }] }],
        generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Gemini Flash image API error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> =
      data.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p.inlineData?.mimeType?.startsWith("image/"));
    if (!imagePart?.inlineData) {
      throw new Error("Gemini Flash returned no image in response.");
    }
    writeFileSync(outputPath, Buffer.from(imagePart.inlineData.data, "base64"));
  }

  private async downloadToFile(url: string, outputPath: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download image: ${response.status}`);
    writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  }
}

// ── Video Generator (Veo 3) ───────────────────────────────────────────────────

export class VideoGenerator {
  private apiKey: string | undefined;
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.apiKey = config.googleApiKey || process.env.GOOGLE_API_KEY;
    this.outputDir = `${config.outputDir}/videos`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(persona: Persona, asset: AssetType, prompt: GeneratedPrompt): Promise<GeneratedAsset> {
    if (!this.apiKey) {
      throw new Error("Google API key required for video generation. Set GOOGLE_API_KEY.");
    }

    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

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
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/veo-3:generateVideo",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: prompt.prompt,
          duration: prompt.parameters?.duration ?? 5,
          aspectRatio: prompt.parameters?.aspectRatio ?? "16:9",
        }),
      }
    );

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Veo API error ${response.status}: ${body || response.statusText}`);
    }

    const data = await response.json();
    return data.video?.uri ?? data.videoUrl ?? "";
  }
}

// ── Unified Asset Generator ───────────────────────────────────────────────────

export class AssetGenerator {
  private svg: SVGGenerator;
  private image: ImageGenerator;
  private video: VideoGenerator;

  constructor(config: GenerationConfig) {
    this.svg = new SVGGenerator(config);
    this.image = new ImageGenerator(config);
    this.video = new VideoGenerator(config);
  }

  async generate(persona: Persona, asset: AssetType, prompt: GeneratedPrompt): Promise<GeneratedAsset> {
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
        results.push(await this.generate(persona, asset, prompt));
      } catch (error) {
        console.error(`Failed to generate ${asset.kind} asset:`, error);
      }
    }
    return results;
  }
}
