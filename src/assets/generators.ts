/**
 * Asset Generation Services
 *
 * SVG: QuiverAI only — no fallback. Requires QUIVER_API_KEY.
 * Image: OpenAI (gpt-image-2.5 / gpt-image-2 / dall-e-3) or Google Gemini.
 * Video: Seedance via BytePlus ModelArk, or Veo via Google API.
 */

import { writeFileSync, mkdirSync } from "node:fs";
import type { Persona } from "../persona/types.js";
import type { AssetType, GeneratedPrompt } from "../generation/prompts.js";
import { assertSafePublicUrl } from "../shared/url.js";

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
  imageProvider?: "openai" | "gemini" | "notorganic";
  /** Request-scoped, server-held Not Organic authorization. Never serialized. */
  notOrganicFetch?: (path: string, init?: RequestInit) => Promise<Response>;
  imageModel?: string;
  imageSize?: string;
  imageQuality?: "standard" | "high";
  imageStyle?: "vivid" | "natural";
  videoProvider?: "seedance" | "veo" | "runway" | "local";
  videoModel?: string;
  videoApiKey?: string;
  videoBaseUrl?: string;
  videoDuration?: number;
  videoRatio?: string;
  videoResolution?: string;
  videoPollIntervalMs?: number;
  videoTimeoutMs?: number;
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
  private provider: "openai" | "gemini" | "notorganic";
  private notOrganicFetch?: GenerationConfig["notOrganicFetch"];
  private model: string;
  private size: string;
  private quality: "standard" | "high";
  private style: "vivid" | "natural";
  private outputDir: string;

  constructor(config: GenerationConfig) {
    this.openaiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.googleKey = config.googleApiKey || process.env.GOOGLE_API_KEY;
    this.provider = config.imageProvider ?? "openai";
    this.notOrganicFetch = config.notOrganicFetch;
    this.model = config.imageModel ?? (this.provider === "notorganic" ? "image" : this.provider === "gemini" ? "imagen-3.0-generate-002" : "gpt-image-2.5");
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

    if (this.provider === "notorganic") {
      if (!this.notOrganicFetch) throw new Error("Sign in to Not Organic before generating hosted images.");
      outputPath = `${this.outputDir}/${id}.png`;
      await this.generateNotOrganic(prompt, outputPath);
      service = "notorganic";
    } else if (this.provider === "gemini") {
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

  private async generateNotOrganic(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    if (this.model !== "image") throw new Error("Choose the available Not Organic image model.");
    const response = await this.notOrganicFetch!("/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(180_000),
      body: JSON.stringify({ model: this.model, prompt: prompt.prompt, size: prompt.parameters?.size ?? this.size, n: 1 }),
    });
    if (!response.ok) {
      if (response.status === 402) throw new Error("Not Organic needs more credit or a higher request budget. Open your wallet in Settings.");
      if (response.status === 401 || response.status === 403) throw new Error("Not Organic image access is unavailable. Sign in again and check your account permissions.");
      throw new Error(`Not Organic image generation failed (${response.status}).`);
    }
    const data = await response.json() as { data?: Array<{ b64_json?: string; url?: string }> };
    const result = data.data?.[0];
    if (typeof result?.b64_json === "string" && result.b64_json) {
      writeFileSync(outputPath, Buffer.from(result.b64_json, "base64"));
    } else if (typeof result?.url === "string") {
      const url = await assertSafePublicUrl(result.url);
      if (url.protocol !== "https:" || url.username || url.password) throw new Error("Not Organic returned an invalid image URL.");
      // Download the provider's HTTPS artifact; credentials are never forwarded.
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000), redirect: "error" });
      if (!response.ok) throw new Error(`Not Organic image download failed (${response.status}).`);
      writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
    } else {
      throw new Error("Not Organic returned no image data.");
    }
  }

  private async generateOpenAI(prompt: GeneratedPrompt, outputPath: string): Promise<void> {
    // https://developers.openai.com/api/docs/guides/image-generation
    // Docs confirm 2.5 Sunburst/Flare, not the bare gpt-image-2.5 alias.
    // Keep the GPT Image 2 shape for that requested alias pending confirmation.
    // GPT Image uses low/medium/high and base64; style is DALL-E-only.
    const isGPTImage = this.model.startsWith("gpt-image-");
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
        quality: isGPTImage && this.quality === "standard" ? "medium" : this.quality,
        ...(isGPTImage ? {} : { style: this.style }),
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

// ── Video Generator (Seedance / Veo) ──────────────────────────────────────────

export class VideoGenerator {
  private apiKey: string | undefined;
  private outputDir: string;
  private provider: NonNullable<GenerationConfig["videoProvider"]>;
  private model: string;
  private config: GenerationConfig;

  constructor(config: GenerationConfig) {
    this.config = config;
    this.provider = config.videoProvider ?? "seedance";
    this.model = config.videoModel ?? (this.provider === "seedance" ? "seedance-1-0-pro-250528" : "veo-3");
    this.apiKey = config.videoApiKey || (this.provider === "seedance" ? process.env.ARK_API_KEY : config.googleApiKey || process.env.GOOGLE_API_KEY);
    this.outputDir = `${config.outputDir}/videos`;
    mkdirSync(this.outputDir, { recursive: true });
  }

  async generate(persona: Persona, asset: AssetType, prompt: GeneratedPrompt): Promise<GeneratedAsset> {
    if (this.provider !== "seedance" && this.provider !== "veo") {
      throw new Error(`Video provider ${this.provider} is not implemented. Choose seedance or veo.`);
    }
    if (!this.apiKey) {
      throw new Error(this.provider === "seedance" ? "Seedance needs ARK_API_KEY" : "Google API key required for video generation. Set GOOGLE_API_KEY.");
    }

    const startTime = Date.now();
    const id = `${persona.id}-${asset.purpose}-${Date.now()}`;

    const videoResult = this.provider === "seedance"
      ? await this.callSeedanceAPI(persona, asset, prompt, `${this.outputDir}/${id}.mp4`)
      : await this.callVeoAPI(prompt);

    return {
      id,
      type: "video",
      content: videoResult,
      prompt: prompt.prompt,
      metadata: {
        service: this.provider === "seedance" ? "byteplus" : "google",
        model: this.model,
        personaId: persona.id,
        assetPurpose: asset.purpose,
        generationTime: Date.now() - startTime,
      },
    };
  }

  private async callSeedanceAPI(persona: Persona, asset: AssetType, prompt: GeneratedPrompt, outputPath: string): Promise<string> {
    // Official create + retrieve contracts (Bearer ARK_API_KEY; id/status/content.video_url):
    // https://docs.byteplus.com/en/docs/modelark/create-video-generation-task-api
    // https://docs.byteplus.com/en/docs/modelark/get-video-generation-task-api
    // Model ID: https://docs.byteplus.com/en/docs/modelark/recommended-models-seedance-1-0-pro
    // fal also hosts Seedance: https://fal.ai/models/bytedance/seedance-2.0/text-to-video/api
    // This adapter uses BytePlus directly; it does not use the fal queue protocol.
    const base = (this.config.videoBaseUrl ?? "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/$/, "");
    const endpoint = `${base}/contents/generations/tasks`;
    const timeoutMs = this.config.videoTimeoutMs ?? 10 * 60_000;
    const intervalMs = this.config.videoPollIntervalMs ?? 5_000;
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isFinite(intervalMs) || intervalMs < 0) {
      throw new Error("Seedance polling requires a positive timeout and nonnegative interval.");
    }
    const signal = AbortSignal.timeout(timeoutMs);
    const headers = { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
    const motion = {
      smooth: "Slow, smooth movement with gentle continuous pacing",
      liquid: "Flowing organic movement, fluid morphs and soft transitions",
      snappy: "Crisp, brief motion accents with readable pauses",
      mechanical: "Precise, rhythmic mechanical movement",
    }[persona.aesthetic.motionStyle];
    const duration = this.config.videoDuration ?? prompt.parameters?.duration ?? 5;
    const ratio = asset.constraints?.aspectRatio ?? this.config.videoRatio ?? prompt.parameters?.aspectRatio ?? "16:9";
    const resolution = this.config.videoResolution ?? prompt.parameters?.quality ?? "1080p";
    // 1.0 Pro accepts whole seconds 2–12 and the listed ratios. Do not silently
    // rewrite explicit parameters for other configured models/endpoints.
    if (this.model.startsWith("seedance-1-0-") && (!Number.isInteger(duration) || Number(duration) < 2 || Number(duration) > 12)) {
      throw new Error("Seedance 1.0 duration must be an integer between 2 and 12 seconds.");
    }
    if (!["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"].includes(String(ratio))) {
      throw new Error(`Unsupported Seedance ratio: ${ratio}`);
    }
    const created = await fetch(endpoint, {
      method: "POST", headers, signal,
      body: JSON.stringify({ model: this.model, content: [{ type: "text", text: `${prompt.prompt}\nMotion: ${motion}. Seamless ambient loop; no text.` }], duration, ratio, resolution }),
    });
    if (!created.ok) throw new Error(`Seedance create task API error ${created.status}`);
    const task = await created.json();
    if (typeof task.id !== "string" || !task.id) throw new Error("Seedance returned no task ID.");

    while (!signal.aborted) {
      const response = await fetch(`${endpoint}/${encodeURIComponent(task.id)}`, { headers, signal });
      if (!response.ok) throw new Error(`Seedance poll task API error ${response.status}`);
      const result = await response.json();
      if (result.status === "succeeded") {
        if (typeof result.content?.video_url !== "string" || !result.content.video_url) {
          throw new Error("Seedance succeeded without a video URL.");
        }
        // Signed download URL; never forward the ARK key to storage hosts.
        const download = await fetch(result.content.video_url, { signal });
        if (!download.ok) throw new Error(`Seedance video download failed: ${download.status}`);
        writeFileSync(outputPath, Buffer.from(await download.arrayBuffer()));
        return outputPath;
      }
      if (["failed", "cancelled", "expired"].includes(result.status)) {
        throw new Error(`Seedance task ${result.status}${result.error?.code ? ` (${result.error.code})` : ""}`);
      }
      if (result.status !== "queued" && result.status !== "running") {
        throw new Error("Seedance returned an unknown task status.");
      }
      await new Promise<void>((resolve, reject) => {
        const done = () => { signal.removeEventListener("abort", abort); resolve(); };
        const timer = setTimeout(done, intervalMs);
        const abort = () => { clearTimeout(timer); reject(new Error("Seedance task polling timed out.")); };
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      });
    }
    throw new Error("Seedance task polling timed out.");
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
