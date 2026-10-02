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
  MATERIAL_KEY,
  MATERIAL_MODES,
  MATERIAL_PALETTES,
  MATERIAL_PRESETS,
  materialRecipe,
  normalizeMaterial,
  parseMaterialRecipe,
  type MaterialLook,
} from "~/lib/materials";
import styles from "./material-lab.css?inline";

const names = {
  cloth: "Shot silk",
  flow: "Thread current",
  moire: "Interference",
  contour: "Chalk contours",
  marble: "Dye bath",
  radial: "Radial pleats",
};
const sliders = [
  { key: "hue", label: "Hue rotation", min: 0, max: 360, step: 1 },
  { key: "scale", label: "Scale", min: 0.5, max: 4, step: 0.05 },
  { key: "density", label: "Density", min: 0.05, max: 1, step: 0.01 },
  { key: "fold", label: "Distortion", min: 0, max: 1.6, step: 0.01 },
  { key: "dye", label: "Dye strength", min: 0, max: 1, step: 0.01 },
  { key: "speed", label: "Motion speed", min: 0, max: 2, step: 0.01 },
] as const;
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const MaterialLab = component$(() => {
  useStyles$(styles);
  const look = useStore<MaterialLook>({ ...DEFAULT_MATERIAL });
  const state = useStore<{ h: NoSerialize<FabricHandle> }>({ h: undefined });
  const canvas = useSignal<HTMLCanvasElement>();
  const file = useSignal<HTMLInputElement>();
  const status = useSignal("Your changes are saved on this device.");
  const ready = useSignal(false);
  const reduced = useSignal(false);
  const sample = useSignal(true);
  const exporting = useSignal(false);
  const preset = useSignal("thread-current");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    try {
      const saved = localStorage.getItem(MATERIAL_KEY);
      if (saved) {
        Object.assign(look, parseMaterialRecipe(saved));
        preset.value = "";
      }
    } catch {
      status.value =
        "Device storage is unavailable or the saved recipe could not be read.";
    }
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      reduced.value = media.matches;
    };
    sync();
    media.addEventListener("change", sync);
    const el = canvas.value;
    if (el) {
      const h = mountFabric(el, { ...look }, { quality: 1, exportable: true });
      if (h) {
        state.h = noSerialize(h);
        ready.value = true;
        el.dataset.ready = "true";
        cleanup(() => h.destroy());
      } else
        status.value =
          "Live preview needs WebGL. You can still explore colours and save a recipe.";
      const lost = () => {
        ready.value = false;
        status.value =
          "The live preview was interrupted. Reload the page to resume; your recipe is saved.";
      };
      el.addEventListener("webglcontextlost", lost);
      cleanup(() => el.removeEventListener("webglcontextlost", lost));
    }
    cleanup(() => media.removeEventListener("change", sync));
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ track }) => {
    const recipe = track(() => materialRecipe({ ...look }));
    state.h?.setLook(parseMaterialRecipe(recipe));
    try {
      localStorage.setItem(MATERIAL_KEY, recipe);
    } catch {
      status.value =
        "Changes are live, but device storage is unavailable. Download a recipe to keep them.";
    }
  });

  const change = $((key: string, value: string) => {
    preset.value = "";
    Object.assign(
      look,
      normalizeMaterial({
        ...look,
        [key]:
          key === "warp" ||
          key === "weft" ||
          key === "ground" ||
          key === "pattern" ||
          key === "colourSpace"
            ? value
            : Number(value),
      }),
    );
  });
  const apply = $(() => {
    try {
      localStorage.setItem(BACKDROP_KEY, materialRecipe({ ...look }));
      window.dispatchEvent(new Event(BACKDROP_EVENT));
      status.value =
        "Applied softly behind Baste. Your preview keeps its full colour.";
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
  return (
    <div class="material-lab">
      <div class="material-presets" aria-label="Material studies">
        {MATERIAL_PRESETS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            class="material-preset"
            title={p.description}
            aria-pressed={preset.value === p.id}
            onClick$={() => {
              Object.assign(look, p.look);
              preset.value = p.id;
            }}
          >
            <span class="material-preset-index">0{i + 1}</span>
            <span>{p.name}</span>
            <span class="material-preset-colours" aria-hidden="true">
              {[p.look.ground, p.look.warp, p.look.weft].map((c) => (
                <i key={c} style={{ background: c }} />
              ))}
            </span>
          </button>
        ))}
      </div>
      <div class="material-workspace">
        <section class="material-stage" aria-label="Live material preview">
          <div
            class="material-preview"
            style={{ backgroundColor: look.ground }}
          >
            <canvas
              ref={canvas}
              aria-label={`${names[look.pattern]} procedural background. Move your pointer to bend it; tap to send a ripple.`}
              role="img"
            />
            {sample.value && (
              <div class="material-type-sample">
                <span class="label">A material, fitted to you.</span>
                <h2>
                  Every thread
                  <br />
                  has a world.
                </h2>
                <p>
                  Room for the work.
                  <br />
                  Texture for the feeling.
                </p>
              </div>
            )}
            {!ready.value && (
              <p class="material-fallback">
                A flat colour preview. Live material needs WebGL.
              </p>
            )}
          </div>
          <div class="material-toolbar">
            <button
              type="button"
              class="material-button"
              aria-pressed={!look.motion}
              onClick$={() => {
                look.motion = !look.motion;
              }}
            >
              {look.motion ? "Pause motion" : "Resume motion"}
            </button>
            <label>
              <input
                type="checkbox"
                checked={sample.value}
                onChange$={(_, el) => {
                  sample.value = el.checked;
                }}
              />{" "}
              Show type
            </label>
            <span class="material-preview-note">
              {reduced.value
                ? "Still preview · reduced motion"
                : look.interaction
                  ? "Move to bend · tap to ripple"
                  : "Pointer interaction off"}
            </span>
          </div>
          <div class="material-actions">
            <button
              type="button"
              class="material-button material-primary"
              disabled={!ready.value || exporting.value}
              onClick$={async () => {
                exporting.value = true;
                try {
                  const blob = await state.h?.snapshot();
                  if (!blob) throw new Error("Preview unavailable.");
                  download(blob, `baste-${look.pattern}-${look.seed}.png`);
                  status.value =
                    "PNG exported at the current preview resolution, without the type sample.";
                } catch (e) {
                  status.value =
                    e instanceof Error
                      ? e.message
                      : "Could not export the preview.";
                } finally {
                  exporting.value = false;
                }
              }}
            >
              {exporting.value ? "Exporting…" : "Export PNG"}
            </button>
            <button
              type="button"
              class="material-button"
              onClick$={() => {
                download(
                  new Blob([materialRecipe({ ...look })], {
                    type: "application/json",
                  }),
                  `baste-${look.pattern}-${look.seed}.json`,
                );
                status.value =
                  "Recipe exported. It preserves the material settings; motion starts afresh when imported.";
              }}
            >
              Save recipe
            </button>
            <button
              type="button"
              class="material-button"
              onClick$={() => file.value?.click()}
            >
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
                  if (f.size > 65536)
                    throw new Error("Choose a recipe smaller than 64 KB.");
                  Object.assign(look, parseMaterialRecipe(await f.text()));
                  preset.value = "";
                  status.value = "Recipe loaded.";
                } catch (e) {
                  status.value =
                    e instanceof Error
                      ? e.message
                      : "Could not load that recipe.";
                } finally {
                  el.value = "";
                }
              }}
            />
          </div>
          <p class="material-status" role="status">
            {status.value}
          </p>
        </section>
        <aside class="material-controls" aria-label="Material controls">
          <div class="material-control-heading">
            <span class="label">Dye &amp; behaviour</span>
            <span class="material-seed-label">Seed {look.seed}</span>
          </div>
          <label class="material-field">
            Technique
            <select
              aria-label="Technique"
              value={look.pattern}
              onChange$={(_, el) => change("pattern", el.value)}
            >
              {MATERIAL_MODES.map((m) => (
                <option key={m} value={m} selected={look.pattern === m}>
                  {names[m]}
                </option>
              ))}
            </select>
          </label>
          <div class="material-seed-row">
            <label class="material-field">
              Seed
              <input
                aria-label="Seed"
                type="number"
                min="0"
                max="65535"
                step="1"
                value={look.seed}
                onInput$={(_, el) => change("seed", el.value)}
              />
            </label>
            <button
              type="button"
              class="material-button"
              onClick$={() => {
                look.seed = crypto.getRandomValues(new Uint16Array(1))[0];
                preset.value = "";
              }}
            >
              Shuffle
            </button>
          </div>
          <fieldset class="material-colour-fields">
            <legend>Colour ramp</legend>
            {(
              [
                ["ground", "Ground"],
                ["warp", "First dye"],
                ["weft", "Second dye"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                <input
                  type="color"
                  value={look[key]}
                  onInput$={(_, el) => change(key, el.value)}
                />
                <span>
                  {label}
                  <small>{look[key]}</small>
                </span>
              </label>
            ))}
          </fieldset>
          <div class="material-palette-list" aria-label="Colour palettes">
            {MATERIAL_PALETTES.map((p) => (
              <button
                type="button"
                key={p.name}
                class="material-palette"
                title={p.name}
                aria-label={`Use ${p.name} palette`}
                onClick$={() => {
                  look.warp = p.warp;
                  look.weft = p.weft;
                  look.ground = p.ground;
                  preset.value = "";
                }}
              >
                {[p.ground, p.warp, p.weft].map((c) => (
                  <i key={c} style={{ background: c }} />
                ))}
                <span>{p.name}</span>
              </button>
            ))}
          </div>
          <label class="material-field">
            Colour blending
            <select
              aria-label="Colour blending"
              value={look.colourSpace}
              onChange$={(_, el) => change("colourSpace", el.value)}
            >
              {(
                [
                  ["rgb", "Classic"],
                  ["oklab", "Perceptual"],
                  ["hue", "Through hue"],
                ] as const
              ).map(([value, label]) => (
                <option
                  key={value}
                  value={value}
                  selected={look.colourSpace === value}
                >
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label class="material-check">
            <input
              type="checkbox"
              checked={look.cycle}
              disabled={reduced.value}
              onChange$={(_, el) => {
                look.cycle = el.checked;
              }}
            />{" "}
            Let the dyes cycle
          </label>
          <div class="material-ranges">
            {sliders.map((s) => (
              <label key={s.key} class="material-range">
                <span>
                  {s.label}
                  <output aria-hidden="true">
                    {s.key === "hue" ? `${look.hue}°` : look[s.key].toFixed(2)}
                  </output>
                </span>
                <input
                  aria-label={s.label}
                  type="range"
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  value={look[s.key]}
                  disabled={s.key === "speed" && reduced.value}
                  onInput$={(_, el) => change(s.key, el.value)}
                />
              </label>
            ))}
          </div>
          {look.pattern === "cloth" && (
            <label class="material-range">
              <span>
                Thread width
                <output aria-hidden="true">{look.thread.toFixed(1)}</output>
              </span>
              <input
                type="range"
                min="1"
                max="8"
                step=".1"
                value={look.thread}
                onInput$={(_, el) => change("thread", el.value)}
              />
            </label>
          )}
          <label class="material-check">
            <input
              type="checkbox"
              checked={look.interaction}
              disabled={reduced.value}
              onChange$={(_, el) => {
                look.interaction = el.checked;
              }}
            />{" "}
            Follow pointer &amp; touch
          </label>
          <div class="material-use">
            <button type="button" class="material-button" onClick$={apply}>
              Use behind Baste
            </button>
            <button type="button" class="material-reset" onClick$={reset}>
              Restore original linen
            </button>
            <p>A quiet wash keeps the interface readable.</p>
          </div>
        </aside>
      </div>
      <div class="material-explanation">
        <p>
          <strong>A seed keeps the composition.</strong> Change the dyes to
          explore the same material in a different world. Distortion bends its
          field; density changes its rhythm. Pause to hold a moment, then export
          a clean image.
        </p>
        <p>
          <strong>Six ways to move.</strong> Currents pull threads together,
          interference reveals slower bands, contours follow changing heights,
          dye baths warp colour, pleats follow a centre, and silk changes colour
          with its folds.
        </p>
      </div>
    </div>
  );
});
