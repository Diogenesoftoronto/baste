/**
 * A vision judge through fal's any-llm endpoint.
 *
 * The OpenAI judge only reads the prompt that produced an asset. This one is
 * shown the generated image itself, so the QD archive places candidates by
 * what they actually look like: their measured colour temperature, density
 * and abstraction. https://fal.ai/models/fal-ai/any-llm/vision/api
 */
import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { safeSvg } from "../shared/stills.js";
import { falRun } from "../assets/fal.js";

/**
 * An SVG as a PNG data URL, so the vision judge sees the drawing rather than
 * its path data. Rendered locally on white at icon-review size.
 */
export function svgPreview(path: string): string | undefined {
  try {
    const png = new Resvg(safeSvg(readFileSync(path, "utf8")), { fitTo: { mode: "width", value: 512 }, background: "#ffffff" }).render().asPng();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return undefined;
  }
}

export async function judgeWithFal(
  system: string,
  user: string,
  options: { model: string; apiKey?: string; temperature?: number; imageUrl?: string },
): Promise<string> {
  const looking = options.imageUrl
    ? "\n\nThe generated asset is attached as an image. Judge what you can see in it; the prompt is only context. The features array must describe the asset as rendered."
    : "";
  // The vision endpoint requires an image; SVG markup and video prompts go to the text endpoint.
  const result = await falRun<{ output?: string; error?: string | null }>(options.imageUrl ? "fal-ai/any-llm/vision" : "fal-ai/any-llm", {
    model: options.model,
    system_prompt: system,
    prompt: user + looking,
    ...(options.imageUrl ? { image_urls: [options.imageUrl] } : {}),
    temperature: options.temperature ?? 0.3,
    max_tokens: 900,
  }, { key: options.apiKey, timeoutMs: 120_000 });
  if (result.error || typeof result.output !== "string" || !result.output.trim()) throw new Error("The fal judge returned no verdict.");
  return result.output;
}
