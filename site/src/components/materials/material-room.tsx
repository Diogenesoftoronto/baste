import { $, component$, useStyles$ } from "@builder.io/qwik";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";
import { voiceOf } from "~/lib/converse";
import {
  MATERIAL_PRESETS,
  MATERIAL_TECHNIQUES,
  MATERIAL_TRY_EVENT,
  materialForPersona,
  materialReason,
  personaSwatch,
  presetSwatch,
  type MaterialLook,
  type MaterialTry,
} from "~/lib/materials";
import styles from "./material-room.css?inline";

/** Hand a look to the workbench lab; the link itself scrolls there. */
const tryOn = $((id: string, name: string, look: MaterialLook) => {
  window.dispatchEvent(new CustomEvent<MaterialTry>(MATERIAL_TRY_EVENT, { detail: { id, name, look } }));
});

/** Bolts hang to slightly different lengths, like cloth on a rack. */
const LENGTHS = [1, 0.86, 0.95, 0.8, 0.97, 0.88];

/**
 * The material room's hero: the six studies hang from a rail as cut bolts of
 * cloth, rendered from the shader itself. Pick one and it goes onto the
 * workbench below.
 */
export const MaterialBolts = component$(() => {
  useStyles$(styles);
  return (
    <header class="mr-hero" aria-labelledby="mr-title">
      <div class="mr-hero-copy">
        <div>
          <span class="label mr-kicker">The material room</span>
          <h1 id="mr-title" class="display">The <em>cloth</em> under the interface.</h1>
        </div>
        <p class="mr-lede">
          Every persona’s interface sits on a material: woven from their palette, moving the way they move, textured like
          the places they love. Take a bolt off the rack to try it on, then bend it, re-dye it and keep it.
        </p>
      </div>
      <div class="mr-rack">
        <span class="mr-rail" aria-hidden="true" />
        <ol class="mr-bolts" aria-label="Material studies">
          {MATERIAL_PRESETS.map((p, i) => (
            <li key={p.id} class="mr-bolt" style={{ "--i": i, "--len": LENGTHS[i] }} data-depth={String([0.02, 0.05, 0.03, 0.06, 0.025, 0.045][i])}>
              <a href="#workbench" class="mr-bolt-link" data-juice="dye" data-dye={p.look.warp} onClick$={() => tryOn(p.id, p.name, p.look)}>
                <span class="mr-bolt-clip" aria-hidden="true" />
                <span class="mr-bolt-cloth">
                  <img src={presetSwatch(p.id)} alt="" width={400} height={500} loading={i < 3 ? "eager" : "lazy"} decoding="async" />
                </span>
                <span class="mr-bolt-tag">
                  <span>No. {String(i + 1).padStart(2, "0")}</span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                  <em aria-hidden="true">Try it on ↓</em>
                </span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </header>
  );
});

const DYES = [
  ["ground", "Ground", "background"],
  ["warp", "First dye", "primary"],
  ["weft", "Second dye", "accent"],
] as const;

/**
 * How a persona becomes a cloth: technique from its aesthetic profile, dyes
 * from its generated palette, composition seeded by its name.
 */
export const PersonaCloths = component$(() => {
  useStyles$(styles);
  return (
    <section id="personas" class="mr-section" aria-labelledby="mr-personas">
      <header class="mr-section-head">
        <span class="label mr-kicker">Fitted cloth</span>
        <h2 id="mr-personas" class="display">Every persona weaves its own.</h2>
        <p>
          Baste chooses the technique from a persona’s aesthetic profile, dyes it with the palette it generated for them
          and seeds it with their name, so the same person always gets the same cloth. Change it in their Studio, and
          their header re-dyes to match.
        </p>
      </header>
      <div class="mr-personas">
        {DEMO_PERSONAS.map((p) => {
          const t = DEMO_TOKENS[p.id];
          const look = materialForPersona(p, t);
          const handle = voiceOf(p.id).handle;
          const swatch = personaSwatch(p.id, true);
          const dye = { ground: look.ground, warp: look.warp, weft: look.weft };
          return (
            <article key={p.id} class="mr-persona">
              <div class="mr-persona-cloth" style={{ background: look.ground }}>
                {swatch && <img src={swatch} alt={`${handle}'s cloth: ${MATERIAL_TECHNIQUES[look.pattern].name.toLowerCase()} in their palette`} width={960} height={600} loading="lazy" decoding="async" />}
                <img class="mr-persona-face" src={`/assets/companions/${p.id}.webp`} alt="" width={64} height={64} loading="lazy" decoding="async" />
              </div>
              <div class="mr-persona-body">
                <span class="mr-persona-meta">{handle} · {MATERIAL_TECHNIQUES[look.pattern].name}</span>
                <h3>{materialReason(p)}</h3>
                <dl class="mr-persona-dyes">
                  {DYES.map(([key, label, token]) => (
                    <div key={key}>
                      <dt><i style={{ background: dye[key] }} aria-hidden="true" />{label}</dt>
                      <dd><code>{dye[key].toUpperCase()}</code> <span>{token}</span></dd>
                    </div>
                  ))}
                </dl>
                <div class="mr-persona-actions">
                  <a href="#workbench" class="mr-button" data-juice="dye" data-dye={look.warp} onClick$={() => tryOn(`persona-${p.id}`, `${handle}'s cloth`, look)}>
                    Try it on
                  </a>
                  <a href={`/gui/?persona=${p.id}&tab=material`} class="mr-link">Open in the Studio <span aria-hidden="true">→</span></a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
});
