import {
  $,
  component$,
  noSerialize,
  useSignal,
  useStore,
  useStyles$,
  useVisibleTask$,
  type NoSerialize,
} from "@builder.io/qwik";
import { mountFabric, type FabricHandle } from "~/components/fx/fabric-gl";
import {
  BACKDROP_EVENT,
  BACKDROP_KEY,
  DEFAULT_MATERIAL,
  MATERIAL_EVENT,
  MATERIAL_KEY,
  MATERIAL_MODES,
  MATERIAL_PALETTES,
  MATERIAL_PRESETS,
  MATERIAL_TECHNIQUES,
  MATERIAL_TRY_EVENT,
  materialRecipe,
  normalizeMaterial,
  parseMaterialRecipe,
  presetSwatch,
  tintHex,
  type MaterialLook,
  type MaterialTry,
} from "~/lib/materials";
import styles from "./material-lab.css?inline";

const CLOTH = [
  { key: "scale", label: "Scale", min: 0.5, max: 4, step: 0.05, hint: "How large the pattern sits." },
  { key: "density", label: "Density", min: 0.05, max: 1, step: 0.01, hint: "Its rhythm: a few lines or many." },
  { key: "fold", label: "Distortion", min: 0, max: 1.6, step: 0.01, hint: "How far the field bends." },
  { key: "dye", label: "Dye strength", min: 0, max: 1, step: 0.01, hint: "How much colour covers the ground." },
] as const;

const BLENDS = [
  ["rgb", "Classic", "Straight mixes; can turn muddy between opposites."],
  ["oklab", "Perceptual", "Even steps the eye reads as even."],
  ["hue", "Through hue", "Travels around the colour wheel."],
] as const;

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface MaterialLabProps {
  /** The look to start from and return to (a persona's own material). */
  initial?: MaterialLook;
  /** Name for that look in the swatch book, e.g. the persona's name. */
  initialName?: string;
  /** A rendered thumbnail of that look, when one exists. */
  initialSwatch?: string;
  /** Where edits are kept on this device. */
  storageKey?: string;
  /** Filename stem for exports. */
  slug?: string;
  /** Words set over the preview. */
  sampleTitle?: string;
  sampleLine?: string;
  /** Anchor id for the lab, so other sections can send a look to it. */
  id?: string;
}

/**
 * A live material you can bend, re-dye and take with you. The preview stays in
 * view while you work through the swatch book and the dye card beside it.
 * Every change saves on this device; a recipe file carries the look elsewhere.
 */
export const MaterialLab = component$<MaterialLabProps>(({ initial, initialName, initialSwatch, storageKey = MATERIAL_KEY, slug = "baste", sampleTitle, sampleLine, id }) => {
  useStyles$(styles);
  const start = initial ? normalizeMaterial(initial) : { ...DEFAULT_MATERIAL };
  const look = useStore<MaterialLook>({ ...start });
  const state = useStore<{ h: NoSerialize<FabricHandle> }>({ h: undefined });
  const canvas = useSignal<HTMLCanvasElement>();
  const file = useSignal<HTMLInputElement>();
  const status = useSignal("Your changes are saved on this device.");
  const ready = useSignal(false);
  const reduced = useSignal(false);
  const sample = useSignal(true);
  const exporting = useSignal(false);
  const preset = useSignal(initial ? "fitted" : "thread-current");
  const tried = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    try {
      const saved = tried.value ? null : localStorage.getItem(storageKey);
      if (saved) {
        Object.assign(look, parseMaterialRecipe(saved));
        preset.value = "";
      }
    } catch {
      status.value = "Device storage is unavailable or the saved recipe could not be read.";
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.value = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    cleanup(() => media.removeEventListener("change", sync));
    const el = canvas.value;
    if (!el) return;
    const h = mountFabric(el, { ...look }, { quality: 1, exportable: true });
    if (h) {
      state.h = noSerialize(h);
      ready.value = true;
      el.dataset.ready = "true";
      cleanup(() => h.destroy());
    } else status.value = "Live preview needs WebGL. You can still choose colours and save a recipe.";
    const lost = () => {
      ready.value = false;
      status.value = "The live preview was interrupted. Reload the page to resume; your recipe is saved.";
    };
    el.addEventListener("webglcontextlost", lost);
    cleanup(() => el.removeEventListener("webglcontextlost", lost));
  });

  // Another section can hand the lab a look to try on, such as a persona's cloth.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const onTry = (event: Event) => {
      const detail = (event as CustomEvent<MaterialTry>).detail;
      if (!detail?.look) return;
      tried.value = true;
      Object.assign(look, normalizeMaterial(detail.look));
      preset.value = MATERIAL_PRESETS.some((p) => p.id === detail.id) ? detail.id : `try:${detail.id}`;
      status.value = `Trying on ${detail.name}. Change anything; it saves on this device.`;
    };
    window.addEventListener(MATERIAL_TRY_EVENT, onTry);
    cleanup(() => window.removeEventListener(MATERIAL_TRY_EVENT, onTry));
  }, { strategy: "document-ready" });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const recipe = track(() => materialRecipe({ ...look }));
    state.h?.setLook(parseMaterialRecipe(recipe));
    try {
      localStorage.setItem(storageKey, recipe);
      window.dispatchEvent(new CustomEvent(MATERIAL_EVENT, { detail: storageKey }));
    } catch {
      status.value = "Changes are live, but device storage is unavailable. Save a recipe to keep them.";
    }
  });

  const change = $((key: string, value: string) => {
    preset.value = "";
    Object.assign(
      look,
      normalizeMaterial({
        ...look,
        [key]: key === "warp" || key === "weft" || key === "ground" || key === "pattern" || key === "colourSpace" ? value : Number(value),
      }),
    );
  });
  const exportPng = $(async () => {
    exporting.value = true;
    try {
      const blob = await state.h?.snapshot();
      if (!blob) throw new Error("Preview unavailable.");
      download(blob, `${slug}-${look.pattern}-${look.seed}.png`);
      status.value = "PNG exported at the preview's resolution, without the type sample.";
    } catch (e) {
      status.value = e instanceof Error ? e.message : "Could not export the preview.";
    } finally {
      exporting.value = false;
    }
  });
  const apply = $(() => {
    try {
      localStorage.setItem(BACKDROP_KEY, materialRecipe({ ...look }));
      window.dispatchEvent(new Event(BACKDROP_EVENT));
      status.value = "Applied softly behind Baste. Your preview keeps its full colour.";
    } catch {
      status.value = "Could not save the background on this device.";
    }
  });
  const reset = $(() => {
    try {
      localStorage.removeItem(BACKDROP_KEY);
      window.dispatchEvent(new Event(BACKDROP_EVENT));
      status.value = "Baste’s original linen background is restored.";
    } catch {
      status.value = "Could not restore the background on this device.";
    }
  });

  const technique = MATERIAL_TECHNIQUES[look.pattern];
  const warp = tintHex(look.warp, look.hue);
  const weft = tintHex(look.weft, look.hue);
  const group = slug.replace(/[^a-z0-9-]/gi, "");

  return (
    <div class="material-lab" id={id}>
      <div class="material-layout">
        <section class="material-stage" aria-label="Live material preview">
          <div class="material-preview" style={{ backgroundColor: look.ground }} data-cursor={look.interaction && !reduced.value ? "press" : undefined}>
            <canvas
              ref={canvas}
              role="img"
              aria-label={`${technique.name}, a living material. ${look.interaction ? "Move across it to bend it; tap to send a ripple." : ""}`}
            />
            <span class="material-stage-name" aria-hidden="true">
              {technique.name} <span>· seed {look.seed}</span>
            </span>
            {sample.value && (
              <div class="material-type-sample">
                <span class="label">A material, fitted to you.</span>
                {sampleTitle ? <h2>{sampleTitle}</h2> : <h2>Every thread<br />has a world.</h2>}
                {sampleLine ? <p>{sampleLine}</p> : <p>Room for the work.<br />Texture for the feeling.</p>}
              </div>
            )}
            {!ready.value && <p class="material-fallback">A flat colour preview. The live material needs WebGL.</p>}
            <div class="material-stage-bar">
              <button type="button" class="material-pill" disabled={reduced.value} onClick$={() => (look.motion = !look.motion)}>
                {look.motion && !reduced.value ? "Pause" : "Play"}
              </button>
              <button type="button" class="material-pill" aria-pressed={sample.value} onClick$={() => (sample.value = !sample.value)}>
                Type sample
              </button>
              <button type="button" class="material-pill material-pill-primary act act-chalk" data-juice="chalk" disabled={!ready.value || exporting.value} onClick$={exportPng}>
                {exporting.value ? "Exporting…" : "Export PNG"}
              </button>
            </div>
          </div>
          <p class="material-stage-note">
            {reduced.value ? "A still preview, because your device prefers reduced motion." : look.interaction ? "Move across the cloth to bend it. Tap to send a ripple." : "Pointer interaction is off."}
          </p>
        </section>

        <div class="material-side">
          <section class="material-book" aria-labelledby={`${group}-book`}>
            <h3 id={`${group}-book`} class="material-heading">Swatch book <small>Start from a study</small></h3>
            <div class="material-swatches" role="group" aria-label="Material studies">
              {initial && (
                <button
                  type="button"
                  class="material-swatch material-swatch-fitted"
                  aria-pressed={preset.value === "fitted"}
                  title="Woven from this persona's palette and aesthetic profile"
                  onClick$={() => {
                    Object.assign(look, start);
                    preset.value = "fitted";
                  }}
                >
                  <span class="material-swatch-cloth" style={{ background: `linear-gradient(135deg, ${start.ground} 30%, ${start.warp} 30% 60%, ${start.weft} 60%)` }}>
                    {initialSwatch && <img src={initialSwatch} alt="" width={400} height={500} loading="lazy" decoding="async" />}
                  </span>
                  <span class="material-swatch-tag">
                    <span>Fitted</span>
                    <strong>{initialName ?? "Fitted"}</strong>
                  </span>
                </button>
              )}
              {MATERIAL_PRESETS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  class="material-swatch"
                  aria-pressed={preset.value === p.id}
                  title={p.description}
                  onClick$={() => {
                    Object.assign(look, p.look);
                    preset.value = p.id;
                    status.value = `${p.name}: ${p.description}`;
                  }}
                >
                  <span class="material-swatch-cloth">
                    <img src={presetSwatch(p.id)} alt="" width={400} height={500} loading="lazy" decoding="async" />
                  </span>
                  <span class="material-swatch-tag">
                    <span>No. {String(i + 1).padStart(2, "0")}</span>
                    <strong>{p.name}</strong>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section class="material-card" aria-label="Dye and behaviour">
            <fieldset class="material-group">
              <legend class="material-heading">Technique <small>Keeps your dyes</small></legend>
              <div class="material-chips">
                {MATERIAL_MODES.map((m) => (
                  <label key={m} class="material-chip" title={MATERIAL_TECHNIQUES[m].hint}>
                    <input type="radio" name={`${group}-technique`} value={m} checked={look.pattern === m} onChange$={() => change("pattern", m)} />
                    {MATERIAL_TECHNIQUES[m].name}
                  </label>
                ))}
              </div>
              <p class="material-hint">{technique.hint}</p>
            </fieldset>

            <fieldset class="material-group">
              <legend class="material-heading">Dyes</legend>
              <div class="material-wells">
                {(
                  [
                    ["ground", "Ground"],
                    ["warp", "First dye"],
                    ["weft", "Second dye"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} class="material-well">
                    <input type="color" value={look[key]} onInput$={(_, el) => change(key, el.value)} />
                    <span class="material-well-chip" style={{ background: key === "ground" ? look.ground : tintHex(look[key], look.hue) }} aria-hidden="true" />
                    <span class="material-well-name">{label}<small>{look[key]}</small></span>
                  </label>
                ))}
              </div>
              <div class="material-lots" role="group" aria-label="Dye lots">
                {MATERIAL_PALETTES.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    class="material-lot"
                    aria-label={`Use the ${p.name} dye lot`}
                    onClick$={() => {
                      look.warp = p.warp;
                      look.weft = p.weft;
                      look.ground = p.ground;
                      preset.value = "";
                    }}
                  >
                    <span aria-hidden="true">{[p.ground, p.warp, p.weft].map((c) => <i key={c} style={{ background: c }} />)}</span>
                    {p.name}
                  </button>
                ))}
              </div>
              <label class="material-range">
                <span>Hue rotation<output>{look.hue}°</output></span>
                <input type="range" min={0} max={360} step={1} value={look.hue} onInput$={(_, el) => change("hue", el.value)} />
              </label>
              <div class="material-blends" role="radiogroup" aria-label="How the dyes mix">
                {BLENDS.map(([value, label, hint]) => (
                  <label key={value} class="material-blend" title={hint}>
                    <input type="radio" name={`${group}-blend`} value={value} checked={look.colourSpace === value} onChange$={() => change("colourSpace", value)} />
                    <span class="material-blend-bar" data-space={value} style={{ "--a": look.ground, "--b": warp, "--c": weft }} aria-hidden="true" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
              <label class="material-toggle">
                <input type="checkbox" checked={look.cycle} disabled={reduced.value} onChange$={(_, el) => (look.cycle = el.checked)} />
                Let the dyes cycle slowly
              </label>
            </fieldset>

            <fieldset class="material-group">
              <legend class="material-heading">Cloth</legend>
              {CLOTH.map((s) => (
                <label key={s.key} class="material-range">
                  <span>{s.label}<output>{look[s.key].toFixed(2)}</output></span>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={look[s.key]} aria-describedby={`${group}-${s.key}-hint`} onInput$={(_, el) => change(s.key, el.value)} />
                  <small id={`${group}-${s.key}-hint`}>{s.hint}</small>
                </label>
              ))}
              {look.pattern === "cloth" && (
                <label class="material-range">
                  <span>Thread width<output>{look.thread.toFixed(1)}</output></span>
                  <input type="range" min={1} max={8} step={0.1} value={look.thread} onInput$={(_, el) => change("thread", el.value)} />
                  <small>Below two device pixels the weave fades, to avoid moiré.</small>
                </label>
              )}
            </fieldset>

            <fieldset class="material-group">
              <legend class="material-heading">Motion</legend>
              <label class="material-range">
                <span>Speed<output>{look.speed.toFixed(2)}</output></span>
                <input type="range" min={0} max={2} step={0.01} value={look.speed} disabled={reduced.value} onInput$={(_, el) => change("speed", el.value)} />
              </label>
              <label class="material-toggle">
                <input type="checkbox" checked={look.interaction} disabled={reduced.value} onChange$={(_, el) => (look.interaction = el.checked)} />
                Bend toward the pointer
              </label>
            </fieldset>

            <fieldset class="material-group">
              <legend class="material-heading">Composition</legend>
              <div class="material-seed">
                <label class="material-field">
                  Seed
                  <input type="number" min={0} max={65535} step={1} value={look.seed} onInput$={(_, el) => change("seed", el.value)} />
                </label>
                <button
                  type="button"
                  class="material-button act act-baste"
                  data-juice="baste"
                  onClick$={() => {
                    look.seed = crypto.getRandomValues(new Uint16Array(1))[0];
                    preset.value = "";
                  }}
                >
                  Shuffle
                </button>
              </div>
              <p class="material-hint">The same seed keeps the same composition, so you can re-dye it freely.</p>
            </fieldset>
          </section>

          <section class="material-take" aria-labelledby={`${group}-take`}>
            <h3 id={`${group}-take`} class="material-heading">Take it with you</h3>
            <div class="material-take-row">
              <button type="button" class="material-button material-primary act act-chalk" data-juice="chalk" disabled={!ready.value || exporting.value} onClick$={exportPng}>
                {exporting.value ? "Exporting…" : "Export PNG"}
              </button>
              <button
                type="button"
                class="material-button act act-chalk"
                data-juice="chalk"
                onClick$={() => {
                  download(new Blob([materialRecipe({ ...look })], { type: "application/json" }), `${slug}-${look.pattern}-${look.seed}.json`);
                  status.value = "Recipe saved. It keeps every setting; motion starts afresh when you load it.";
                }}
              >
                Save recipe
              </button>
              <button type="button" class="material-button act act-baste" onClick$={() => file.value?.click()}>
                Load recipe
              </button>
              <input
                ref={file}
                type="file"
                accept="application/json,.json"
                hidden
                aria-label="Load a material recipe"
                onChange$={async (_, el) => {
                  try {
                    const f = el.files?.[0];
                    if (!f) return;
                    if (f.size > 65536) throw new Error("Choose a recipe smaller than 64 KB.");
                    Object.assign(look, parseMaterialRecipe(await f.text()));
                    preset.value = "";
                    status.value = "Recipe loaded.";
                  } catch (e) {
                    status.value = e instanceof Error ? e.message : "Could not load that recipe.";
                  } finally {
                    el.value = "";
                  }
                }}
              />
            </div>
            <div class="material-take-row">
              <button type="button" class="material-button act" data-juice="dye" data-dye={look.warp} onClick$={apply}>
                Use behind Baste
              </button>
              <button type="button" class="material-link" data-juice="unpick" onClick$={reset}>
                Restore the original linen
              </button>
            </div>
            <p class="material-status" role="status">{status.value}</p>
          </section>
        </div>
      </div>
    </div>
  );
});
