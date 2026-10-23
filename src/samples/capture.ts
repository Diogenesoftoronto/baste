import { assertSafePublicUrl } from "../shared/url.js";
import { parseImageDimensions } from "../shared/img-dims.js";

/**
 * A page as Baste samples it: its first screens as one PNG, and what the DOM
 * says is on them (images, inline SVG icons, buttons, headings) with exact
 * boxes and measured styles. Colours and type are measured here because a
 * vision model can't read them reliably (see clairic.ts).
 *
 * Every request the page makes, including redirects and subresources, passes
 * the same public-host check as decompose, so a page can't make Baste reach
 * private addresses.
 */

export interface Box { x: number; y: number; w: number; h: number }

export interface DomElement {
  kind: "image" | "svg" | "button" | "heading" | "background";
  box: Box;
  /** Image or background source. */
  src?: string;
  /** Inline SVG markup with currentColor resolved. */
  svg?: string;
  text?: string;
  alt?: string;
  /** The element sits in a header, nav or brand link: likely a logo. */
  brand?: boolean;
}

export interface PageStyles {
  background: string;
  text: string;
  headingFont: string;
  headingSize: number;
  headingColor: string;
  bodyFont: string;
  buttonBackground?: string;
  buttonColor?: string;
  buttonRadius?: number;
}

export interface PageCapture {
  url: string;
  finalUrl: string;
  title: string;
  screenshot: Buffer;
  /** Layout size; boxes use it. The screenshot is `scale` times denser. */
  width: number;
  height: number;
  scale: number;
  elements: DomElement[];
  styles: PageStyles;
}

export const CAPTURE = { width: 1440, viewportHeight: 900, maxHeight: 1800, scale: 2, maxElements: 80, maxSvgChars: 60_000 } as const;

type PageLike = {
  route(pattern: string, handler: (route: { request(): { url(): string }; abort(): Promise<void>; continue(): Promise<void> }) => Promise<void>): Promise<void>;
  goto(url: string, opts: { waitUntil: string; timeout: number }): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T>(expression: string): Promise<T>;
  screenshot(opts: { clip: { x: number; y: number; width: number; height: number }; fullPage: boolean; type: "png" }): Promise<Buffer>;
  title(): Promise<string>;
  url(): string;
};
type BrowserLike = { newContext(opts: Record<string, unknown>): Promise<{ newPage(): Promise<PageLike> }>; close(): Promise<void> };

async function launch(): Promise<BrowserLike> {
  let chromium: { launch(opts: Record<string, unknown>): Promise<BrowserLike> };
  try {
    ({ chromium } = await import("playwright-core" as string));
  } catch {
    throw new Error("Sampling a site needs playwright-core. Install Baste's optional dependencies.");
  }
  const attempts = [
    ...(process.env.BASTE_CHROME_PATH ? [{ executablePath: process.env.BASTE_CHROME_PATH }] : []),
    { channel: "chrome" },
    {},
  ];
  // A development shell's LD_LIBRARY_PATH (Nix, devenv) can break the system browser's own libraries.
  const { LD_LIBRARY_PATH: _shell, ...env } = process.env;
  for (const options of attempts) {
    try { return await chromium.launch({ headless: true, env, ...options }); } catch { /* try the next browser */ }
  }
  throw new Error("No browser to capture with. Install Google Chrome or set BASTE_CHROME_PATH.");
}

/** Runs in the page: elements in the captured area and the styles that matter. */
function inventory(args: { maxHeight: number; maxElements: number; maxSvgChars: number }) {
  const out: DomElement[] = [];
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    // Includes ancestors: closed menus are often only transparent, not removed.
    if (r.width < 12 || r.height < 12 || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true })) return null;
    const box = { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) };
    return box.y < args.maxHeight && box.x < innerWidth && box.x + box.w > 0 ? box : null;
  };
  const brand = (el: Element) => !!el.closest("header, nav, [class*=logo i], [id*=logo i], a[href='/'], a[aria-label*=home i]");
  for (const img of Array.from(document.querySelectorAll("img"))) {
    const box = visible(img);
    if (box && img.currentSrc) out.push({ kind: "image", box, src: img.currentSrc, alt: img.alt || undefined, brand: brand(img) });
  }
  for (const svg of Array.from(document.querySelectorAll("svg"))) {
    if (svg.parentElement?.closest("svg")) continue;
    const box = visible(svg);
    if (!box || box.w > 640 || box.h > 640) continue;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const color = getComputedStyle(svg).color;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${box.w} ${box.h}`);
    clone.setAttribute("width", String(box.w));
    clone.setAttribute("height", String(box.h));
    const markup = clone.outerHTML.replace(/currentColor/g, color);
    if (markup.length <= args.maxSvgChars) out.push({ kind: "svg", box, svg: markup, alt: svg.getAttribute("aria-label") ?? undefined, brand: brand(svg) });
  }
  for (const el of Array.from(document.querySelectorAll("button, a[role=button], a[class*=btn i], a[class*=button i], input[type=submit]"))) {
    const box = visible(el);
    const text = (el.textContent || (el as HTMLInputElement).value || "").trim().replace(/\s+/g, " ");
    if (box && text && text.length <= 60) out.push({ kind: "button", box, text });
  }
  for (const el of Array.from(document.querySelectorAll("h1, h2"))) {
    const box = visible(el);
    const text = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (box && text) out.push({ kind: "heading", box, text: text.slice(0, 200) });
  }
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    if (out.length >= args.maxElements * 2) break;
    const bg = getComputedStyle(el).backgroundImage;
    const match = /url\(["']?([^"')]+)["']?\)/.exec(bg);
    if (!match || match[1].startsWith("data:")) continue;
    const box = visible(el);
    if (box && box.w >= 48 && box.h >= 48) out.push({ kind: "background", box, src: new URL(match[1], location.href).href });
  }
  const css = (el: Element | null) => el ? getComputedStyle(el) : null;
  const opaque = (el: Element | null): string => {
    for (let node = el; node; node = node.parentElement) {
      const c = getComputedStyle(node).backgroundColor;
      if (c && !/rgba\(.*,\s*0\)$|transparent/.test(c)) return c;
    }
    return "rgb(255, 255, 255)";
  };
  const heading = document.querySelector("h1") ?? document.querySelector("h2");
  const button = out.find((e) => e.kind === "button") ? Array.from(document.querySelectorAll("button, a[role=button], a[class*=btn i], a[class*=button i]")).find((el) => visible(el)) ?? null : null;
  const styles = {
    background: opaque(document.body),
    text: css(document.body)!.color,
    headingFont: css(heading)?.fontFamily ?? css(document.body)!.fontFamily,
    headingSize: parseFloat(css(heading)?.fontSize ?? "0") || 0,
    headingColor: css(heading)?.color ?? css(document.body)!.color,
    bodyFont: css(document.querySelector("p") ?? document.body)!.fontFamily,
    ...(button ? { buttonBackground: opaque(button), buttonColor: css(button)!.color, buttonRadius: parseFloat(css(button)!.borderTopLeftRadius) || 0 } : {}),
  };
  const height = Math.min(args.maxHeight, Math.max(document.documentElement.scrollHeight, innerHeight));
  return { elements: out.slice(0, args.maxElements), styles, height };
}

/** Runs in the page: clicks the close control of each visible dialog or overlay. */
function dismissOverlays(): boolean {
  const CLOSE = /^(close|×|✕|✖|x|dismiss|no,? thanks|not now|閉じる|关闭|fermer|cerrar|schließen)$/i;
  let closed = false;
  for (const el of Array.from(document.querySelectorAll("body *"))) {
    const s = getComputedStyle(el);
    const overlay = el.matches("dialog[open], [role=dialog], [role=alertdialog], [aria-modal=true]") || ((s.position === "fixed" || s.position === "absolute") && Number(s.zIndex) >= 10);
    if (!overlay || !el.checkVisibility()) continue;
    const r = el.getBoundingClientRect();
    if (r.width < innerWidth * 0.2 || r.height < 80) continue;
    // Close controls are often plain spans with a click handler, so any small element counts.
    const button = Array.from(el.querySelectorAll("button, a, [role=button], input[type=button], span, div, i")).find((b) => {
      if (b.children.length > 1 || b.getBoundingClientRect().width > 240) return false;
      const label = ((b as HTMLElement).innerText || (b as HTMLInputElement).value || b.getAttribute("aria-label") || "").trim();
      return CLOSE.test(label) || /^close/i.test(b.getAttribute("aria-label") ?? "") || (!label && /(^|[-_ ])close([-_ ]|$)/i.test(b.getAttribute("class") ?? ""));
    }) as HTMLElement | undefined;
    if (button && (!(button instanceof HTMLAnchorElement) || !button.href || button.getAttribute("href")?.startsWith("#") || button.href.startsWith("javascript:"))) { button.click(); closed = true; }
  }
  return closed;
}

/** `rgb(r, g, b)` or `rgba(...)` as #rrggbb; anything else unchanged. */
export function toHex(color: string): string {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return m ? `#${m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, "0")).join("")}` : color;
}

/** First family of a CSS font stack, unquoted. */
export const firstFamily = (stack: string) => stack.split(",")[0]?.trim().replace(/^['"]|['"]$/g, "") ?? "";

export async function capturePage(url: string, opts: { allowPrivateHosts?: boolean; timeoutMs?: number } = {}): Promise<PageCapture> {
  await assertSafePublicUrl(url, opts);
  const checked = new Map<string, Promise<boolean>>();
  const allowed = (target: string) => {
    let origin: string;
    try { origin = new URL(target).origin; } catch { return Promise.resolve(false); }
    if (target.startsWith("data:") || target.startsWith("blob:")) return Promise.resolve(true);
    if (!checked.has(origin)) checked.set(origin, assertSafePublicUrl(target, opts).then(() => true, () => false));
    return checked.get(origin)!;
  };
  const browser = await launch();
  try {
    const context = await browser.newContext({
      viewport: { width: CAPTURE.width, height: CAPTURE.viewportHeight },
      // Icons are often 16 px: a 2× capture gives their crops real detail.
      deviceScaleFactor: CAPTURE.scale,
      userAgent: "BasteSampler/0.2 (+https://baste.love)",
      acceptDownloads: false,
      serviceWorkers: "block",
    });
    const page = await context.newPage();
    await page.route("**/*", async (route) => (await allowed(route.request().url()) ? route.continue() : route.abort()));
    await page.goto(url, { waitUntil: "networkidle", timeout: opts.timeoutMs ?? 25_000 }).catch(async (error) => {
      // A page that never goes quiet (analytics, live feeds) is still captured as it stands.
      if (!/Timeout/i.test(String(error))) throw new Error("The page could not be opened.");
    });
    await page.waitForTimeout(800);
    // Close announcement popups so they don't cover the page. Only "close"-type
    // controls inside dialogs or fixed overlays are clicked; consent is never given.
    // Twice: some popups open a moment after the page settles.
    const dismiss = `(() => { const __name = (f) => f; return (${dismissOverlays.toString()})(); })()`;
    for (const wait of [0, 1200]) { await page.waitForTimeout(wait); if (await page.evaluate<boolean>(dismiss)) await page.waitForTimeout(500); }
    // Sent as source text: a transpiler's injected helpers (esbuild's __name under tsx) don't exist in the page.
    const limits = JSON.stringify({ maxHeight: CAPTURE.maxHeight, maxElements: CAPTURE.maxElements, maxSvgChars: CAPTURE.maxSvgChars });
    const found = await page.evaluate<ReturnType<typeof inventory>>(`(() => { const __name = (f) => f; return (${inventory.toString()})(${limits}); })()`);
    const height = Math.max(CAPTURE.viewportHeight, Math.round(found.height));
    // Without fullPage, Playwright silently clips to the viewport.
    const screenshot = await page.screenshot({ clip: { x: 0, y: 0, width: CAPTURE.width, height }, fullPage: true, type: "png" });
    const actual = parseImageDimensions(new Uint8Array(screenshot.buffer, screenshot.byteOffset, screenshot.byteLength));
    if (!actual || actual.width !== CAPTURE.width * CAPTURE.scale) throw new Error("The page could not be captured.");
    const layoutHeight = Math.round(actual.height / CAPTURE.scale);
    const s = found.styles;
    return {
      url, finalUrl: page.url(), title: (await page.title()).slice(0, 200), screenshot, width: CAPTURE.width, height: layoutHeight, scale: CAPTURE.scale,
      elements: found.elements.filter((e) => e.box.y < layoutHeight),
      styles: {
        ...s, background: toHex(s.background), text: toHex(s.text), headingColor: toHex(s.headingColor),
        headingFont: firstFamily(s.headingFont), bodyFont: firstFamily(s.bodyFont),
        ...(s.buttonBackground ? { buttonBackground: toHex(s.buttonBackground) } : {}),
        ...(s.buttonColor ? { buttonColor: toHex(s.buttonColor) } : {}),
      },
    };
  } finally {
    await browser.close();
  }
}
