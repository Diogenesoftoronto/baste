import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { spawnSync } from "node:child_process";
import type { Persona } from "../persona/types.js";
import type { AestheticProfile } from "../persona/types.js";
import { buildPersona } from "../persona/builder.js";
import { safeFetchText, safeFetchBuffer } from "../shared/url.js";

export interface BrandKit {
  sourceUrl: string;
  fetchedAt: string;
  title: string;
  description: string;
  palette: string[];
  paletteRoles: PaletteRoles;
  fonts: string[];
  fontFaces: FontFaceRef[];
  logo?: string;
  logoSvg?: string;
  ogImage?: string;
  background?: string;
  images: { url: string; alt?: string }[];
  rawText: string;
  signals: ExtractedSignals;
  localAssets?: LocalAssetMap;
}

export interface PaletteRoles {
  background?: string;
  surface?: string;
  text?: string;
  textMuted?: string;
  border?: string;
  primary?: string;
  secondary?: string;
  accent?: string;
}

export interface FontFaceRef {
  family: string;
  src?: string;
  weight?: string;
  style?: string;
}

export interface ExtractedSignals {
  borderRadiusMax: number;
  borderRadiusAvg: number;
  transitionTimings: string[];
  hasGrid: boolean;
  hasMonoFont: boolean;
  bodyFontCategory: "sans" | "serif" | "mono" | "display" | "unknown";
  imageCount: number;
  ratingPalette: number;
}

export interface LocalAssetMap {
  dir: string;
  logo?: string;
  ogImage?: string;
  paletteSwatch?: string;
  thumbnails: { source: string; local: string }[];
}

export interface DecomposeResult {
  persona: Persona;
  brandKit: BrandKit;
}

export interface DecomposeOptions {
  id: string;
  name?: string;
  maxImages?: number;
  maxStylesheets?: number;
  deep?: boolean;
  timeoutMs?: number;
  saveAssetsDir?: string;
  generatePaletteSwatch?: boolean;
  allowPrivateHosts?: boolean;
}

export async function decomposeUrl(url: string, opts: DecomposeOptions): Promise<DecomposeResult> {
  const fetched = opts.deep
    ? await fetchDeep(url, opts.timeoutMs)
    : await fetchPlain(url, opts.timeoutMs, opts.allowPrivateHosts);
  const { html, finalUrl } = fetched;
  const base = resolveBaseHref(html, new URL(finalUrl));

  const title = matchOne(html, /<title[^>]*>([^<]+)<\/title>/i) ?? base.hostname;
  const description =
    matchMeta(html, "description") ??
    matchMeta(html, "og:description") ??
    matchMeta(html, "twitter:description") ??
    "";
  const ogImage = absolutize(matchMeta(html, "og:image") ?? matchMeta(html, "twitter:image"), base);

  const logoSvg = findInlineLogoSvg(html);
  const logo = absolutize(findLogoImage(html) ?? findIconHref(html), base);

  const images = extractImages(html, base).slice(0, opts.maxImages ?? 30);

  const inlineCss = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n");
  const linkedCssUrls = extractStylesheetLinks(html, base).slice(0, opts.maxStylesheets ?? 6);
  const linkedCss = await fetchAllCss(linkedCssUrls, opts.timeoutMs, 0, opts.allowPrivateHosts);
  const rawCss = `${inlineCss}\n${linkedCss}`;
  const css = resolveCssVariables(rawCss);

  const palette = rankColors(css);
  const fonts = rankFonts(css);
  const fontFaces = extractFontFaces(css, base);
  const background = pickBackground(css);
  const rawText = stripTags(html).slice(0, 8000);

  const paletteRoles = assignPaletteRoles(palette);
  const signals = extractSignals(css, fonts, images.length);

  const brandKit: BrandKit = {
    sourceUrl: finalUrl,
    fetchedAt: new Date().toISOString(),
    title,
    description,
    palette,
    paletteRoles,
    fonts,
    fontFaces,
    logo,
    logoSvg,
    ogImage,
    background,
    images,
    rawText,
    signals,
  };

  if (opts.saveAssetsDir) {
    brandKit.localAssets = await mirrorAssets(brandKit, opts);
  }

  const persona = brandKitToPersona(brandKit, opts);
  return { persona, brandKit };
}

async function fetchPlain(url: string, timeoutMs?: number, allowPrivateHosts?: boolean): Promise<{ html: string; finalUrl: string }> {
  const html = await safeFetchText(url, { timeoutMs, allowPrivateHosts });
  return { html, finalUrl: url };
}

async function fetchDeep(url: string, timeoutMs?: number): Promise<{ html: string; finalUrl: string }> {
  type PlaywrightLike = {
    chromium: {
      launch: (opts: { headless: boolean }) => Promise<{
        newContext: (opts: { userAgent: string }) => Promise<{
          newPage: () => Promise<{
            goto: (url: string, opts: { waitUntil: string; timeout: number }) => Promise<unknown>;
            content: () => Promise<string>;
            url: () => string;
          }>;
        }>;
        close: () => Promise<void>;
      }>;
    };
  };
  let pwMod: PlaywrightLike;
  try {
    pwMod = (await import("playwright" as string)) as unknown as PlaywrightLike;
  } catch (err) {
    console.warn(`[decompose] Failed to import playwright: ${err instanceof Error ? err.message : String(err)}`);
    throw new Error(
      "Deep mode requires playwright. Install it with: npm install --save-dev playwright && npx playwright install chromium"
    );
  }
  const browser = await pwMod.chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ userAgent: "BasteDecomposer/0.2" });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs ?? 20_000 });
    const html = await page.content();
    const finalUrl = page.url();
    return { html, finalUrl };
  } finally {
    await browser.close();
  }
}

async function fetchAllCss(urls: string[], timeoutMs?: number, depth = 0, allowPrivateHosts?: boolean): Promise<string> {
  if (depth > 2) return "";
  const results: string[] = [];
  for (const u of urls) {
    try {
      const css = await safeFetchText(u, { timeoutMs, allowPrivateHosts });
      results.push(css);
      const imports = [...css.matchAll(/@import\s+(?:url\()?["']?([^"')]+)["']?\)?\s*(?:[^;]*)?;/gi)]
        .map((m) => m[1])
        .map((p) => {
          try { return new URL(p, u).toString(); } catch {
            console.warn(`[decompose] Invalid @import URL "${p}" in ${u}`);
            return null;
          }
        })
        .filter((p): p is string => !!p);
      if (imports.length) results.push(await fetchAllCss(imports, timeoutMs, depth + 1, allowPrivateHosts));
    } catch (err) {
      console.warn(`[decompose] Failed to fetch CSS from ${u}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return results.join("\n");
}

function resolveBaseHref(html: string, fallback: URL): URL {
  const m = html.match(/<base[^>]+href=["']([^"']+)["']/i);
  if (!m) return fallback;
  try { return new URL(m[1], fallback); } catch (err) {
    console.warn(`[decompose] Invalid <base href> "${m[1]}": ${err instanceof Error ? err.message : String(err)}`);
    return fallback;
  }
}

function matchOne(s: string, re: RegExp): string | undefined {
  const m = s.match(re);
  return m ? decodeEntities(m[1].trim()) : undefined;
}

function matchMeta(html: string, name: string): string | undefined {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeEntities(m[1].trim());
  }
  return undefined;
}

function findIconHref(html: string): string | undefined {
  const candidates = [
    /<link[^>]+rel=["'](?:apple-touch-icon[^"']*|icon|shortcut icon|mask-icon)["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:apple-touch-icon[^"']*|icon|shortcut icon|mask-icon)["']/i,
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m) return m[1];
  }
  return undefined;
}

function findLogoImage(html: string): string | undefined {
  const headerScopes = [
    html.match(/<header[^>]*>([\s\S]{0,4000})<\/header>/i)?.[1],
    html.match(/<nav[^>]*>([\s\S]{0,4000})<\/nav>/i)?.[1],
  ].filter(Boolean) as string[];

  for (const scope of [...headerScopes, html]) {
    for (const tag of scope.match(/<img[^>]+>/gi) ?? []) {
      const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1] || "";
      const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      const cls = tag.match(/\bclass=["']([^"']*)["']/i)?.[1] || "";
      const id = tag.match(/\bid=["']([^"']*)["']/i)?.[1] || "";
      if (src && /\blogo\b|brand|wordmark/i.test(`${alt} ${cls} ${id} ${src}`)) {
        return src;
      }
    }
  }
  return undefined;
}

function findInlineLogoSvg(html: string): string | undefined {
  const re = /<svg\b[^>]*>[\s\S]*?<\/svg>/gi;
  for (const match of html.match(re) ?? []) {
    const before = html.slice(Math.max(0, html.indexOf(match) - 300), html.indexOf(match));
    if (/logo|brand|wordmark/i.test(before) || /aria-label=["'][^"']*logo[^"']*["']/i.test(match)) {
      return match.slice(0, 12_000);
    }
  }
  return undefined;
}

function extractStylesheetLinks(html: string, base: URL): string[] {
  const out: string[] = [];
  const re = /<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
  for (const tag of html.match(re) ?? []) {
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const abs = absolutize(href, base);
    if (abs) out.push(abs);
  }
  return out;
}

function extractImages(html: string, base: URL): { url: string; alt?: string }[] {
  const out: { url: string; alt?: string }[] = [];
  const seen = new Set<string>();
  const push = (raw: string | undefined, alt?: string) => {
    const abs = absolutize(raw, base);
    if (abs && !abs.startsWith("data:") && !seen.has(abs)) {
      seen.add(abs);
      out.push({ url: abs, alt: alt || undefined });
    }
  };

  for (const tag of html.match(/<img[^>]+>/gi) ?? []) {
    const src = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    const alt = tag.match(/\balt=["']([^"']*)["']/i)?.[1];
    push(src, alt);
    if (srcset) {
      for (const entry of srcset.split(",")) {
        const u = entry.trim().split(/\s+/)[0];
        push(u, alt);
      }
    }
  }
  for (const tag of html.match(/<source[^>]+>/gi) ?? []) {
    const srcset = tag.match(/\bsrcset=["']([^"']+)["']/i)?.[1];
    if (!srcset) continue;
    for (const entry of srcset.split(",")) {
      const u = entry.trim().split(/\s+/)[0];
      push(u);
    }
  }
  return out;
}

function absolutize(href: string | undefined, base: URL): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, base).toString();
  } catch (err) {
    console.warn(`[decompose] Invalid href "${href}" against base ${base}: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

function resolveCssVariables(css: string): string {
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/--([a-zA-Z0-9_-]+)\s*:\s*([^;{}]+)\s*[;}]/g)) {
    vars.set(m[1], m[2].trim());
  }
  let prev = "";
  let cur = css;
  for (let i = 0; i < 3 && cur !== prev; i++) {
    prev = cur;
    cur = cur.replace(/var\(\s*--([a-zA-Z0-9_-]+)\s*(?:,\s*([^)]+))?\)/g, (_full, name, fallback) => {
      return vars.get(name) ?? (fallback ? fallback.trim() : "transparent");
    });
  }
  return cur;
}

function rankColors(css: string): string[] {
  const counts = new Map<string, number>();
  const bump = (hex: string) => counts.set(hex, (counts.get(hex) ?? 0) + 1);

  for (const m of css.matchAll(/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g)) bump(normalizeHex(m[1]));
  for (const m of css.matchAll(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi)) {
    bump(rgbToHex(+m[1], +m[2], +m[3]));
  }
  for (const m of css.matchAll(/hsla?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)/gi)) {
    bump(hslToHex(+m[1], +m[2], +m[3]));
  }

  return [...counts.entries()]
    .map(([hex, count]) => ({ hex, count, score: scoreForRanking(hex, count) }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.hex)
    .slice(0, 12);
}

function scoreForRanking(hex: string, count: number): number {
  const { s, l } = hexToHsl(hex);
  const saturationBoost = 1 + s * 1.5;
  const midToneBoost = 1 - Math.abs(l - 0.5);
  return count * saturationBoost * (0.5 + midToneBoost * 0.5);
}

function assignPaletteRoles(palette: string[]): PaletteRoles {
  if (palette.length === 0) return {};
  const ranked = palette.map((hex) => ({ hex, ...hexToHsl(hex) }));
  const lights = ranked.filter((c) => c.l > 0.85).sort((a, b) => b.l - a.l);
  const darks = ranked.filter((c) => c.l < 0.2).sort((a, b) => a.l - b.l);
  const mids = ranked.filter((c) => c.l >= 0.2 && c.l <= 0.85);

  const brand = mids.filter((c) => c.s > 0.25).sort((a, b) => b.s - a.s);

  const background = lights[0]?.hex ?? mids.find((c) => c.l > 0.7)?.hex;
  const surface = lights[1]?.hex ?? background;
  const text = darks[0]?.hex ?? mids.find((c) => c.l < 0.4)?.hex;
  const textMuted = darks[1]?.hex ?? mids.find((c) => c.l < 0.6 && c.l > 0.3)?.hex;
  const border = lights[2]?.hex ?? lights[0]?.hex;
  const primary = brand[0]?.hex;
  const secondary = brand[1]?.hex;
  const accent = brand.find((c) => primary && hueDistance(c, hexToHsl(primary)) > 30)?.hex ?? brand[2]?.hex;

  return { background, surface, text, textMuted, border, primary, secondary, accent };
}

function hueDistance(a: { h: number }, b: { h: number }): number {
  const d = Math.abs(a.h - b.h) % 360;
  return d > 180 ? 360 - d : d;
}

function normalizeHex(h: string): string {
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return `#${s.toLowerCase()}`;
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function hslToHex(h: number, s: number, l: number): string {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hp = (h % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let [r1, g1, b1] = [0, 0, 0];
  if (hp < 1) [r1, g1, b1] = [c, x, 0];
  else if (hp < 2) [r1, g1, b1] = [x, c, 0];
  else if (hp < 3) [r1, g1, b1] = [0, c, x];
  else if (hp < 4) [r1, g1, b1] = [0, x, c];
  else if (hp < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = ln - c / 2;
  return rgbToHex(Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255));
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return { h, s, l };
}

function rankFonts(css: string): string[] {
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/font-family\s*:\s*([^;{}]+)/gi)) {
    const families = m[1].split(",").map((s) =>
      s.trim().replace(/^["']|["']$/g, "").trim()
    );
    for (const fam of families) {
      if (!fam) continue;
      if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|-apple-system|inherit|initial|unset|blinkmacsystemfont|var\(.+\))$/i.test(fam)) continue;
      counts.set(fam, (counts.get(fam) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f).slice(0, 8);
}

function extractFontFaces(css: string, base: URL): FontFaceRef[] {
  const out: FontFaceRef[] = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]+)\}/gi)) {
    const block = m[1];
    const family = block.match(/font-family\s*:\s*["']?([^"';]+?)["']?\s*;/i)?.[1]?.trim();
    if (!family) continue;
    const srcRaw = block.match(/src\s*:\s*([^;]+);/i)?.[1];
    let src: string | undefined;
    if (srcRaw) {
      const urlMatch = srcRaw.match(/url\(["']?([^"')]+)["']?\)/i);
      if (urlMatch) src = absolutize(urlMatch[1], base);
    }
    out.push({
      family,
      src,
      weight: block.match(/font-weight\s*:\s*([^;]+)/i)?.[1]?.trim(),
      style: block.match(/font-style\s*:\s*([^;]+)/i)?.[1]?.trim(),
    });
  }
  return out;
}

function pickBackground(css: string): string | undefined {
  const m = css.match(/background(?:-image)?\s*:[^;]*url\(["']?([^"')]+)["']?\)/i);
  return m ? m[1] : undefined;
}

function extractSignals(css: string, fonts: string[], imageCount: number): ExtractedSignals {
  const radii: number[] = [];
  for (const m of css.matchAll(/border-radius\s*:\s*([^;{}]+)/gi)) {
    const first = m[1].trim().split(/\s+/)[0];
    const n = parseFloat(first);
    if (!Number.isNaN(n) && n >= 0 && n < 10000) radii.push(n);
  }
  const timings: string[] = [];
  for (const m of css.matchAll(/transition-timing-function\s*:\s*([^;{}]+)/gi)) {
    timings.push(m[1].trim());
  }
  for (const m of css.matchAll(/cubic-bezier\([^)]+\)/gi)) {
    timings.push(m[0]);
  }
  const hasGrid = /display\s*:\s*grid|grid-template-/.test(css);
  const hasMonoFont = fonts.some((f) => /mono|code|consolas|menlo|courier|fira|jetbrains|cascadia/i.test(f));
  const bodyFontCategory = inferFontCategory(fonts[0]);

  return {
    borderRadiusMax: radii.length ? Math.max(...radii) : 0,
    borderRadiusAvg: radii.length ? radii.reduce((a, b) => a + b, 0) / radii.length : 0,
    transitionTimings: [...new Set(timings)].slice(0, 5),
    hasGrid,
    hasMonoFont,
    bodyFontCategory,
    imageCount,
    ratingPalette: 0,
  };
}

function inferFontCategory(font: string | undefined): ExtractedSignals["bodyFontCategory"] {
  if (!font) return "unknown";
  if (/mono|code|courier|fira|jetbrains|menlo|consolas/i.test(font)) return "mono";
  if (/serif|garamond|georgia|playfair|palatino|times|merriweather/i.test(font)) return "serif";
  if (/display|black|condensed|grotesk|impact/i.test(font)) return "display";
  return "sans";
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

async function mirrorAssets(kit: BrandKit, opts: DecomposeOptions): Promise<LocalAssetMap> {
  const dir = join(opts.saveAssetsDir!, opts.id);
  mkdirSync(dir, { recursive: true });
  const map: LocalAssetMap = { dir, thumbnails: [] };

  if (kit.logo) {
    const path = await downloadTo(kit.logo, dir, "logo", opts.timeoutMs);
    if (path) map.logo = path;
  }
  if (kit.ogImage) {
    const path = await downloadTo(kit.ogImage, dir, "og-image", opts.timeoutMs);
    if (path) map.ogImage = path;
  }
  for (let i = 0; i < Math.min(kit.images.length, 12); i++) {
    const img = kit.images[i];
    const path = await downloadTo(img.url, dir, `image-${i}`, opts.timeoutMs);
    if (path) map.thumbnails.push({ source: img.url, local: path });
  }

  if (opts.generatePaletteSwatch && kit.palette.length > 0) {
    const swatch = await tryGeneratePaletteSwatch(kit.palette, dir);
    if (swatch) map.paletteSwatch = swatch;
  }
  return map;
}

async function downloadTo(url: string, dir: string, name: string, timeoutMs?: number): Promise<string | null> {
  try {
    const { data, contentType } = await safeFetchBuffer(url, { timeoutMs });
    const ext = extFromContentType(contentType) || extFromUrl(url) || ".bin";
    const path = join(dir, `${name}${ext}`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
    return path;
  } catch (err) {
    console.warn(`[decompose] Failed to download ${url}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function extFromContentType(ct: string): string | null {
  if (ct.includes("svg")) return ".svg";
  if (ct.includes("png")) return ".png";
  if (ct.includes("jpeg") || ct.includes("jpg")) return ".jpg";
  if (ct.includes("webp")) return ".webp";
  if (ct.includes("gif")) return ".gif";
  if (ct.includes("avif")) return ".avif";
  if (ct.includes("ico")) return ".ico";
  return null;
}

function extFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const e = extname(u.pathname).toLowerCase();
    if (/^\.(svg|png|jpe?g|webp|gif|avif|ico)$/.test(e)) return e === ".jpeg" ? ".jpg" : e;
  } catch (err) {
    console.warn(`[decompose] Invalid image URL "${url}": ${err instanceof Error ? err.message : String(err)}`);
  }
  return null;
}

async function tryGeneratePaletteSwatch(palette: string[], dir: string): Promise<string | undefined> {
  const seamagic = locateSeamagic();
  if (!seamagic) return undefined;
  const out = join(dir, "palette.png");
  try {
    const colors = palette.slice(0, 6);
    if (colors.length === 0) return undefined;
    const tmp = join(dir, "_swatch_base.png");
    const r1 = spawnSync(seamagic, ["canvas", "-o", tmp, "--width", "600", "--height", "100", "--color", colors[0]], { encoding: "utf-8" });
    if (r1.status !== 0) return undefined;
    spawnSync("cp", [tmp, out]);
    return out;
  } catch (err) {
    console.warn(`[decompose] Failed to generate color swatch with seamagic: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

function locateSeamagic(): string | null {
  const which = spawnSync("which", ["seamagic"], { encoding: "utf-8" });
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim();
  const guess = `${process.env.HOME}/Projects/mcp-image-design/target/release/seamagic`;
  const probe = spawnSync(guess, ["--version"], { encoding: "utf-8" });
  if (probe.status === 0) return guess;
  return null;
}

function brandKitToPersona(kit: BrandKit, opts: DecomposeOptions): Persona {
  const summary =
    kit.description ||
    `Decomposed from ${kit.sourceUrl}. ${kit.title}`.slice(0, 220);

  const visualKeywords = uniqueKeywords([
    ...kit.fonts.slice(0, 3),
    ...Object.values(kit.paletteRoles).filter((x): x is string => !!x).slice(0, 4),
    ...kit.images.flatMap((i) => (i.alt ? i.alt.split(/\s+/).slice(0, 2) : [])),
  ]);

  const moodKeywords = topWords(kit.rawText, 10);

  return buildPersona({
    id: opts.id,
    name: opts.name || kit.title || opts.id,
    summary,
    culture: { values: moodKeywords.slice(0, 4) },
    influences: {
      visualArtists: [],
      spaces: [],
      tools: kit.fonts.slice(0, 3),
      obsessions: [],
    },
    aesthetic: inferAesthetic(kit, visualKeywords, moodKeywords),
  });
}

function inferAesthetic(kit: BrandKit, visualKeywords: string[], moodKeywords: string[]): Partial<AestheticProfile> {
  return {
    colorTemperature: inferTemperatureFromPalette(kit.palette),
    density: inferDensityFromText(kit.rawText),
    edgeStyle: inferEdgeStyle(kit.signals),
    motionStyle: inferMotionStyle(kit.signals),
    typographyStyle: inferTypographyStyle(kit.signals, kit.fonts),
    textureStyle: kit.background ? "textured" : "flat",
    iconStyle: kit.logoSvg ? "line" : "filled",
    layoutStyle: kit.signals.hasGrid ? "grid" : "organic",
    visualKeywords,
    moodKeywords,
  };
}

export function inferTemperatureFromPalette(palette: string[]): AestheticProfile["colorTemperature"] {
  if (palette.length === 0) return "neutral";
  let warm = 0;
  let cool = 0;
  let darkest = 255;
  let lightest = 0;
  for (const hex of palette.slice(0, 8)) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    if (r > b + 12) warm++;
    if (b > r + 12) cool++;
    const lum = (r + g + b) / 3;
    darkest = Math.min(darkest, lum);
    lightest = Math.max(lightest, lum);
  }
  if (lightest - darkest > 190) return "high-contrast";
  if (warm > cool) return "warm";
  if (cool > warm) return "cool";
  return "neutral";
}

function inferDensityFromText(text: string): AestheticProfile["density"] {
  const len = text.length;
  if (len < 400) return "minimal";
  if (len > 4500) return "maximalist";
  if (len > 2000) return "dense";
  return "rich";
}

function inferEdgeStyle(signals: ExtractedSignals): AestheticProfile["edgeStyle"] {
  if (signals.borderRadiusMax >= 999) return "soft";
  if (signals.borderRadiusAvg > 12) return "soft";
  if (signals.borderRadiusAvg > 4) return "organic";
  if (signals.borderRadiusMax === 0) return "brutalist";
  return "sharp";
}

function inferMotionStyle(signals: ExtractedSignals): AestheticProfile["motionStyle"] {
  const joined = signals.transitionTimings.join(" ").toLowerCase();
  if (/cubic-bezier\([^)]*1[\.,]/.test(joined)) return "snappy";
  if (/ease-in-out|ease/.test(joined)) return "smooth";
  if (/linear|steps/.test(joined)) return "mechanical";
  if (signals.transitionTimings.length === 0) return "snappy";
  return "smooth";
}

function inferTypographyStyle(signals: ExtractedSignals, fonts: string[]): AestheticProfile["typographyStyle"] {
  const joined = fonts.join(" ").toLowerCase();
  if (/grotesk|condensed|black|display|impact/.test(joined)) return "expressive";
  if (/futur|rajdhani|orbitron|space/.test(joined)) return "futuristic";
  if (/(?<!sans-)\bserif\b|garamond|palatino|playfair|merriweather|georgia/.test(joined)) return "handcrafted";
  if (signals.bodyFontCategory === "mono") return "futuristic";
  return "clean";
}

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "your", "you", "our", "are",
  "but", "not", "have", "has", "all", "can", "will", "more", "what", "when", "they",
  "their", "about", "into", "than", "then", "out", "any", "some", "one", "two",
  "use", "using", "used", "get", "make", "made", "also", "just", "like", "want",
  "need", "may", "now", "new", "see", "way", "who", "how", "why", "where", "which",
  "been", "being", "was", "were", "his", "her", "she", "him", "its",
]);

function topWords(text: string, n: number): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.toLowerCase().split(/[^a-z]+/)) {
    if (raw.length < 4 || STOPWORDS.has(raw)) continue;
    counts.set(raw, (counts.get(raw) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

function uniqueKeywords(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter((s) => s.length > 0))].slice(0, 12);
}
