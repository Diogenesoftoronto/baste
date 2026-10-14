import { text, personaText } from "~/i18n/runtime";
import { useLocale } from "~/i18n/provider";
import { component$, useStyles$ } from "@builder.io/qwik";
import type { DesignTokens, Persona } from "~/lib/api-types";
import { fittingVars } from "~/lib/fitting";
import fittings from "~/lib/fittings.json";
import { fittingIcons } from "~/lib/fitting-icons";
import styles from "./garment.css?inline";

interface GarmentProps {
  persona: Persona;
  tokens: DesignTokens;
  /** "full" is the hero-size screen; "compact" is the small preview used in conversation. */
  size?: "full" | "compact";
  class?: string;
}

interface Fitting {
  hero?: { src: string };
  icon?: { src: string };
  "icon-collection"?: { src: string };
  loop?: { src: string; poster: string };
}

const cap = (s: string | undefined) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

/** Stable small number from a string, for believable counts. */
function seeded(s: string, mod: number, min = 1): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return min + (Math.abs(h) % mod);
}

/**
 * One app screen, cut three ways. The content always comes from the persona's
 * own world, but the layout follows its aesthetic profile too: a rich organic
 * persona gets a field-notes spread, a maximalist one a packed board, a minimal
 * one a quiet single column. Generated art comes from a real Baste run;
 * curated icons replace unsuitable illustrations in the live fitting.
 */
export const Garment = component$<GarmentProps>(({ persona, tokens, size = "full", class: cls }) => {
  useStyles$(styles);
  const art = { ...(fittings as Record<string, Fitting>)[persona.id], ...fittingIcons[persona.id] };
  const layout = persona.aesthetic?.density === "maximalist" || persona.aesthetic?.density === "dense"
    ? "board"
    : persona.aesthetic?.density === "minimal" ? "quiet" : "notes";
  return (
    <div class="garment-frame">
    <div
      class={`fitting garment garment--${layout} ${size === "compact" ? "garment--compact" : ""} ${cls ?? ""}`}
      data-texture={persona.aesthetic?.textureStyle}
      style={fittingVars(tokens)}
    >
      <Chrome persona={persona} />
      {layout === "board" ? <Board persona={persona} art={art} /> : layout === "quiet" ? <Quiet persona={persona} art={art} /> : <Notes persona={persona} art={art} />}
    </div>
    </div>
  );
});

const Chrome = component$<{ persona: Persona }>(({ persona }) => {
  const locale = useLocale();
  return (
  <div class="garment-chrome">
    <span class="garment-dots" aria-hidden="true"><i /><i /><i /></span>
    <span class="f-mono garment-url">{persona.id}{".app"}</span>
    <span class="garment-tabs">
      <span>{text(locale.value, "Library")}</span>
      <span aria-current="page">{text(locale.value, "Collections")}</span>
      <span>{text(locale.value, "Notes")}</span>
    </span>
  </div>
);
});

/** Rich and organic: a field-notes spread with an illustrated plate and margin notes. */
const Notes = component$<{ persona: Persona; art: Fitting }>(({ persona, art }) => {
  const locale = useLocale();
  const inf = persona.influences;
  return (
    <div class="garment-body">
      <figure class="garment-plate">
        {art.hero && <img src={art.hero.src} alt="" width={1600} height={900} loading="lazy" decoding="async" />}
        <figcaption class="f-mono">{text(locale.value, "Plate")} {seeded(persona.id, 40, 12)} · {cap(personaText(locale.value, persona, inf.spaces[0]))}</figcaption>
      </figure>
      <div class="garment-lead">
        <span class="garment-eyebrow f-mono">{text(locale.value, "Field notes ·")} {personaText(locale.value, persona, persona.culture.region ?? "")}</span>
        <h3 class="f-heading">{cap(personaText(locale.value, persona, inf.obsessions[0]))}</h3>
        <p>{text(locale.value, "Slow observations on")} {personaText(locale.value, persona, inf.obsessions[1])}{" "}{text(locale.value, "and")} {personaText(locale.value, persona, inf.obsessions[3] ?? inf.obsessions[2])}{text(locale.value, ", pinned as you find them.")}</p>
        <div class="garment-actions">
          <span class="f-btn">
            {art["icon-collection"] && <img src={art["icon-collection"].src} alt="" width={20} height={20} />}{text(locale.value, "Start a collection")} </span>
          <span class="f-btn f-btn--ghost">{text(locale.value, "Browse the herbarium")}</span>
        </div>
      </div>
      <ul class="garment-specimens">
        {inf.spaces.slice(0, 3).map((s, i) => (
          <li key={s} class="f-surface">
            <span class="f-mono">{text(locale.value, "No.")} {String(seeded(s, 90, 10)).padStart(3, "0")}</span>
            <strong>{cap(personaText(locale.value, persona, s))}</strong>
            <small>{["fruiting", "dormant", "spreading"][i]}</small>
          </li>
        ))}
      </ul>
      <p class="garment-margin f-mono">{text(locale.value, "Listening:")} {inf.music.artists[0]} — {personaText(locale.value, persona, inf.music.genres[0])}</p>
    </div>
  );
});

/** Maximalist: a packed board — ticker, lots of cells, prices, everything within reach. */
const Board = component$<{ persona: Persona; art: Fitting }>(({ persona, art }) => {
  const locale = useLocale();
  const inf = persona.influences;
  const items = [...inf.spaces, ...inf.obsessions].slice(0, 6);
  return (
    <div class="garment-body">
      <div class="garment-ticker f-mono" aria-hidden="true">
        <span>{inf.spaces.map((s) => `${personaText(locale.value, persona, s).toUpperCase()} ●`).join(" ")} {inf.music.artists[0].toUpperCase()} {text(locale.value, "ON AIR")} {"●"}</span>
      </div>
      <div class="garment-board">
        <div class="garment-feature">
          {art.hero && <img src={art.hero.src} alt="" width={1600} height={900} loading="lazy" decoding="async" />}
          <div class="garment-feature-copy">
            <span class="garment-eyebrow f-mono">{text(locale.value, "Open late ·")} {seeded(persona.id, 60, 40)}{" "}{text(locale.value, "stalls")}</span>
            <h3 class="f-heading">{cap(personaText(locale.value, persona, inf.obsessions[0]))}</h3>
            <div class="garment-actions">
              <span class="f-btn">
                {art["icon-collection"] && <img src={art["icon-collection"].src} alt="" width={20} height={20} />}{text(locale.value, "New order")} </span>
              <span class="f-btn f-btn--ghost">{text(locale.value, "Tonight's map")}</span>
            </div>
          </div>
        </div>
        {items.map((s, i) => (
          <div key={s} class={`f-surface garment-cell garment-cell--${i % 3}`}>
            <span class="f-mono">#{String(seeded(s, 98, 1)).padStart(2, "0")}</span>
            <strong>{cap(personaText(locale.value, persona, s))}</strong>
            <span class="garment-price f-mono">¥{seeded(s, 900, 120)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/** Minimal and soft: one quiet column, a single image, lots of floor. */
const Quiet = component$<{ persona: Persona; art: Fitting }>(({ persona, art }) => {
  const locale = useLocale();
  const inf = persona.influences;
  return (
    <div class="garment-body">
      <div class="garment-lead">
        <span class="garment-eyebrow f-mono">{personaText(locale.value, persona, persona.culture.region ?? "")} · {seeded(persona.id, 9, 1)}{" "}{text(locale.value, "visitors")}</span>
        <h3 class="f-heading">{cap(personaText(locale.value, persona, inf.obsessions[0]))}</h3>
        <p>{text(locale.value, "An archive of")} {personaText(locale.value, persona, inf.obsessions[3] ?? inf.obsessions[1])}{text(locale.value, ", found and kept. Nothing here is urgent.")}</p>
      </div>
      <figure class="garment-window">
        {art.hero && <img src={art.hero.src} alt="" width={1600} height={900} loading="lazy" decoding="async" />}
        <figcaption class="f-mono">{personaText(locale.value, persona, inf.spaces[0])} {"— 03:14 AM"}</figcaption>
      </figure>
      <ol class="garment-index f-mono">
        {inf.spaces.slice(1, 4).map((s) => (
          <li key={s}><span>{cap(personaText(locale.value, persona, s))}</span><span>{seeded(s, 28, 1)}{" "}{text(locale.value, "files")}</span></li>
        ))}
      </ol>
      <div class="garment-actions">
        <span class="f-btn">
          {art["icon-collection"] && <img src={art["icon-collection"].src} alt="" width={20} height={20} />}{text(locale.value, "Save to archive")} </span>
        <span class="f-btn f-btn--ghost">{text(locale.value, "Wander")}</span>
      </div>
    </div>
  );
});
