import { component$ } from "@builder.io/qwik";

/**
 * Atelier icon set.
 * - Reicon outline icons (MIT; Solar-derived, CC BY 4.0 — see
 *   public/assets/icons/reicon/LICENSE), inlined at build time.
 * - Hand-drawn tailoring glyphs Reicon doesn't have: needle, spool,
 *   tape measure, thread, button. 24px grid, 1.5 stroke to match.
 */
const reicon = import.meta.glob("/public/assets/icons/reicon/*.svg", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

const REICON: Record<string, string> = {};
for (const [path, raw] of Object.entries(reicon)) {
  const name = path.split("/").pop()!.replace(/\.svg$/, "");
  REICON[name] = raw.replace(/^<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

const S = 'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"';

const DRAWN: Record<string, string> = {
  needle: `<path ${S} d="M4 20 18.5 5.5"/><path ${S} d="M17 4.6l1.6-1.6a1.7 1.7 0 0 1 2.4 2.4L19.4 7"/><path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="2.2 2" d="M19.8 4.2c2.6 3.4.4 7.6-4 8.4S7 15 6 21"/>`,
  spool: `<path ${S} d="M6 3h12M6 21h12"/><path ${S} d="M8 3v18M16 3v18"/><path ${S} d="M8 7.5h8M8 10.5h8M8 13.5h8M8 16.5h8"/>`,
  "tape-measure": `<circle ${S} cx="10" cy="11" r="7"/><circle ${S} cx="10" cy="11" r="2"/><path ${S} d="M17 11v7h5"/><path ${S} d="M19 18v-1.5M21 18v-1"/>`,
  thread: `<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="3 2.4" d="M3 17c3-6 6 2 9-4s6-3 9-8"/>`,
  button: `<circle ${S} cx="12" cy="12" r="8.5"/><circle ${S} cx="12" cy="12" r="5.5" stroke-dasharray="1.6 1.6"/><circle fill="currentColor" cx="10.4" cy="10.4" r="1"/><circle fill="currentColor" cx="13.6" cy="10.4" r="1"/><circle fill="currentColor" cx="10.4" cy="13.6" r="1"/><circle fill="currentColor" cx="13.6" cy="13.6" r="1"/>`,
};

export type AtelierIconName =
  | "needle" | "spool" | "tape-measure" | "thread" | "button"
  | "scissors" | "ruler" | "ruler-pen" | "pin" | "shirt" | "hanger" | "palette" | "layers" | "wand"
  | "sparkle" | "swatch" | "image" | "image-sparkle" | "video" | "video-cut" | "type" | "code" | "download"
  | "terminal" | "globe" | "shuffle" | "pen" | "pen-sparkle" | "folder" | "copy" | "grid"
  | "arrow-right" | "arrow-down" | "check" | "plus";

interface Props {
  name: AtelierIconName;
  size?: number;
  label?: string;
  class?: string;
}

export const AtelierIcon = component$<Props>(({ name, size = 20, label, class: cls }) => {
  const body = DRAWN[name] ?? REICON[name] ?? "";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      class={cls}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : "true"}
      dangerouslySetInnerHTML={body}
    />
  );
});
