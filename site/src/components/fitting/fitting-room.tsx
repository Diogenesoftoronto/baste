import { $, component$, sync$, useSignal, useStyles$, useVisibleTask$ } from "@builder.io/qwik";
import type { DesignTokens, PersonaRecord } from "~/lib/api-types";
import { primaryFamily } from "~/lib/fonts";
import { voiceOf } from "~/lib/converse";
import fittings from "~/lib/fittings.json";
import { fittingIcons } from "~/lib/fitting-icons";
import { Fabric, lookFromTokens } from "~/components/fx/fabric";
import { Garment } from "./garment";
import { ImageDetail } from "./image-detail";
import styles from "./fitting-room.css?inline";

interface FittingRoomProps {
  personas: PersonaRecord[];
  tokens: Record<string, DesignTokens>;
  /** Auto-advance between personas until the visitor picks one. */
  autoplay?: boolean;
  /** Show the spec rail: tokens, generated icons and the archive spread. */
  showMeasurements?: boolean;
}

interface ArchiveCell {
  src: string;
  cell: string;
  features: number[];
  quality: number;
}

interface Art {
  icon?: { src: string; label?: string };
  "icon-collection"?: { src: string; label?: string };
  archive?: ArchiveCell[];
  run?: { candidates: number; generations: number };
}

/**
 * One interface, fitted live to each persona. The screen is pinned to a bolt
 * of cloth dyed in that persona's colours; the spec rail beside it reads like
 * a designer's redline — the faces, swatches, radius and motion that changed,
 * the icons Baste drew for them, and the spread of variants its search kept.
 */
export const FittingRoom = component$<FittingRoomProps>(({ personas, tokens, autoplay = true, showMeasurements = true }) => {
  useStyles$(styles);
  const index = useSignal(0);
  const touched = useSignal(false);
  const stage = useSignal<HTMLDivElement>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoplay && !reduced) {
      const id = setInterval(() => {
        if (!touched.value) index.value = (index.value + 1) % personas.length;
      }, 5600);
      cleanup(() => clearInterval(id));
    }
    // Pointer tilt: the pinned screen leans toward the cursor.
    const el = stage.value;
    if (!el || reduced || !window.matchMedia("(pointer: fine)").matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--tilt-x", `${(-y * 4).toFixed(2)}deg`);
        el.style.setProperty("--tilt-y", `${(x * 6).toFixed(2)}deg`);
        el.style.setProperty("--shift-x", `${(x * -12).toFixed(1)}px`);
        el.style.setProperty("--shift-y", `${(y * -8).toFixed(1)}px`);
      });
    };
    const onLeave = () => {
      for (const p of ["--tilt-x", "--tilt-y", "--shift-x", "--shift-y"]) el.style.removeProperty(p);
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    cleanup(() => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    });
  });

  const pick = $((i: number) => {
    touched.value = true;
    index.value = i;
  });

  const persona = personas[index.value];
  const t = tokens[persona.id];
  const a = persona.aesthetic;
  const art: Art = { ...(fittings as Record<string, Art>)[persona.id], ...fittingIcons[persona.id] };
  const swatches = (["background", "surface", "primary", "secondary", "accent", "text"] as const).map((role) => ({ role, hex: t.colors[role] }));

  return (
    <div class="fitting-room" data-measurements={showMeasurements ? "true" : "false"}>
      <div role="tablist" aria-label="Fit for persona" class="fitting-tabs">
        {personas.map((p, i) => {
          const pt = tokens[p.id];
          const selected = i === index.value;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`fit-${p.id}`}
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              aria-controls="fitting-panel"
              data-juice="pin"
              onClick$={() => pick(i)}
              onKeyDown$={[sync$((event: KeyboardEvent) => {
                if (["Home", "End", "ArrowRight", "ArrowLeft"].includes(event.key)) event.preventDefault();
              }), $(async (event: KeyboardEvent) => {
                const next = event.key === "Home" ? 0 : event.key === "End" ? personas.length - 1 : event.key === "ArrowRight" ? (i + 1) % personas.length : event.key === "ArrowLeft" ? (i + personas.length - 1) % personas.length : -1;
                if (next < 0) return;
                await pick(next);
                document.getElementById(`fit-${personas[next].id}`)?.focus();
              })]}
              class="fitting-tab"
              style={{ "--tab-primary": pt.colors.primary, "--tab-accent": pt.colors.accent }}
            >
              <img src={`/assets/companions/${p.id}.webp`} alt="" width={40} height={40} loading="lazy" decoding="async" />
              <span>
                <strong>{voiceOf(p.id).handle}</strong>
                <small>{p.name.replace(/^The /, "")}</small>
              </span>
              {autoplay && selected && !touched.value && <i class="fitting-tab-timer" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div class="fitting-stage-grid">
        <div ref={stage} class="fitting-stage">
          <div aria-hidden="true" class="fitting-cloth">
            <div class="pinked fitting-cloth-cut">
              <Fabric look={lookFromTokens(t, a.density)} quality={0.75} label={`${persona.name} cloth`} />
            </div>
          </div>
          <div id="fitting-panel" role="tabpanel" aria-labelledby={`fit-${persona.id}`} class="fitting-garment">
            <span class="pin-head" style={{ left: "-6px", top: "-6px" }} aria-hidden="true" />
            <span class="pin-head" style={{ right: "22px", top: "-7px" }} aria-hidden="true" />
            <Garment persona={persona} tokens={t} />
          </div>
        </div>

        {showMeasurements && (
          <aside class="fitting-spec" aria-label={`Measurements for ${persona.name}`} onPointerOver$={() => { touched.value = true; }} onFocusIn$={() => { touched.value = true; }}>
            <section>
              <h3 class="fitting-spec-title">Type</h3>
              <div class="fitting-type">
                <span class="fitting-type-sample" style={{ fontFamily: t.typography.fontFamily.heading }}>Aa</span>
                <dl>
                  <div><dt>Display</dt><dd>{primaryFamily(t.typography.fontFamily.heading)}</dd></div>
                  <div><dt>Text</dt><dd>{primaryFamily(t.typography.fontFamily.body)}</dd></div>
                </dl>
              </div>
            </section>
            <section>
              <h3 class="fitting-spec-title">Colour</h3>
              <ul class="fitting-swatches">
                {swatches.map((s) => (
                  <li key={s.role}>
                    <i style={{ background: s.hex }} />
                    <span>{s.role}</span>
                    <code>{s.hex.toUpperCase()}</code>
                  </li>
                ))}
              </ul>
            </section>
            <section class="fitting-metrics">
              <div>
                <h3 class="fitting-spec-title">Radius</h3>
                <span class="fitting-radius" style={{ borderRadius: t.borders.radius.lg }} aria-hidden="true" />
                <code>{t.borders.radius.base} · {a.edgeStyle}</code>
              </div>
              <div>
                <h3 class="fitting-spec-title">Motion</h3>
                <span class="fitting-motion" style={{ "--motion": t.motion.duration.slow, "--ease": t.motion.easing.default }} aria-hidden="true"><i /></span>
                <code>{t.motion.duration.base} · {a.motionStyle}</code>
              </div>
            </section>
            {(art.icon || art["icon-collection"]) && (
              <section>
                <h3 class="fitting-spec-title">Icons drawn for {voiceOf(persona.id).handle}</h3>
                <div class="fitting-icons">
                  {[art.icon, art["icon-collection"]].filter(Boolean).map((icon) => (
                    <ImageDetail key={icon!.src} src={icon!.src} label={icon!.label ?? `${voiceOf(persona.id).handle} icon`} width={72} height={72} />
                  ))}
                </div>
              </section>
            )}
            {art.archive && art.archive.length > 1 && (
              <section>
                <h3 class="fitting-spec-title">
                  {art.archive.length} variants kept from {art.run?.candidates} tried
                </h3>
                <ul class="fitting-archive">
                  {art.archive.slice(0, 8).map((c) => (
                    <li key={c.src}>
                      <ImageDetail src={c.src} label={`${voiceOf(persona.id).handle} · ${c.features[0] > 0 ? "Warm" : "Cool"} study · Judge ${Math.round(c.quality * 100)}`} width={720} height={405} />
                    </li>
                  ))}
                </ul>
                <a class="fitting-spec-link" href="/method/#archive">How the archive is searched <span aria-hidden="true">→</span></a>
              </section>
            )}
          </aside>
        )}
      </div>
    </div>
  );
});
