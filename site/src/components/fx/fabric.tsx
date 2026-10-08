import {
  component$,
  noSerialize,
  useSignal,
  useStore,
  useVisibleTask$,
  type NoSerialize,
} from "@builder.io/qwik";
import {
  BACKDROP_EVENT,
  BACKDROP_KEY,
  parseMaterialRecipe,
} from "~/lib/materials";
import { css } from "styled-system/css";
import type { DesignTokens } from "~/lib/api-types";
import { DraftingGrid } from "./drafting-grid";
import {
  LINEN,
  mountFabric,
  type FabricHandle,
  type FabricLook,
} from "./fabric-gl";

/** Dye the cloth from a persona's tokens: primary warp over a ground-tinted weft. */
export function lookFromTokens(t: DesignTokens, density?: string): FabricLook {
  const c = t.colors;
  return {
    warp: c.primary,
    weft: c.background,
    ground: c.surface,
    dye: 0.92,
    fold: density === "maximalist" || density === "dense" ? 0.85 : 0.65,
    weave: 0.75,
    thread: 2.6,
    scale: 1.5,
    grain: 0.025,
  };
}

interface FabricProps {
  look?: FabricLook;
  class?: string;
  style?: Record<string, string>;
  quality?: number;
  parallax?: number;
  windowPointer?: boolean;
  label?: string;
}

/**
 * A live bolt of cloth. Changing `look` re-dyes it in place (eased, not cut).
 * Falls back to a flat ground colour without WebGL.
 */
export const Fabric = component$<FabricProps>(
  ({
    look = LINEN,
    class: cls,
    style,
    quality,
    parallax,
    windowPointer,
    label,
  }) => {
    const canvas = useSignal<HTMLCanvasElement>();
    const handle = useStore<{ h: NoSerialize<FabricHandle> }>({ h: undefined });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ cleanup }) => {
      if (!canvas.value) return;
      const h = mountFabric(canvas.value, look, {
        quality,
        parallax,
        windowPointer,
      });
      if (!h) return;
      handle.h = noSerialize(h);
      canvas.value.dataset.ready = "true";
      cleanup(() => h.destroy());
    });

    // eslint-disable-next-line qwik/no-use-visible-task
    useVisibleTask$(({ track }) => {
      const l = track(() => look);
      handle.h?.setLook(l);
    });

    // Without WebGL the CSS weave underneath stays visible: warp over weft,
    // with a diagonal light for folds. The shader fades in over it.
    const weave = `linear-gradient(115deg, rgba(255,255,255,0.18), rgba(0,0,0,0.12) 45%, rgba(255,255,255,0.1) 70%, rgba(0,0,0,0.14)), repeating-linear-gradient(90deg, ${look.warp} 0 ${look.thread}px, transparent ${look.thread}px ${look.thread * 2}px), repeating-linear-gradient(0deg, ${look.weft} 0 ${look.thread}px, ${look.ground} ${look.thread}px ${look.thread * 2}px)`;
    return (
      <div
        class={`${css({ position: "relative", w: "100%", h: "100%" })} ${cls ?? ""}`}
        style={{
          backgroundImage: weave,
          transition: "background 0.6s",
          ...style,
        }}
      >
        <canvas
          ref={canvas}
          role={label ? "img" : undefined}
          aria-label={label}
          aria-hidden={label ? undefined : "true"}
          class={css({
            display: "block",
            position: "absolute",
            inset: 0,
            w: "100%",
            h: "100%",
            transition: "opacity 1.2s token(easings.thread)",
            opacity: 0,
            "&[data-ready=true]": { opacity: 1 },
          })}
        />
      </div>
    );
  },
);

/** The page itself: fixed linen behind everything, drifting slightly with scroll. */
export const FabricBackdrop = component$(() => {
  const custom = useSignal<FabricLook>();
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const sync = () => {
      try {
        const raw = localStorage.getItem(BACKDROP_KEY);
        custom.value = raw ? parseMaterialRecipe(raw) : undefined;
      } catch {
        custom.value = undefined;
      }
    };
    sync();
    window.addEventListener(BACKDROP_EVENT, sync);
    window.addEventListener("storage", sync);
    cleanup(() => {
      window.removeEventListener(BACKDROP_EVENT, sync);
      window.removeEventListener("storage", sync);
    });
  });
  return (
    <div
      aria-hidden="true"
      class={css({
        position: "fixed",
        inset: 0,
        zIndex: -1,
        pointerEvents: "none",
        overflow: "hidden",
      })}
    >
      <Fabric
        look={
          custom.value ?? {
            ...LINEN,
            pattern: "cloth",
            seed: 0,
            density: 0.5,
            speed: 1,
            motion: true,
            interaction: true,
            hue: 0,
            cycle: false,
            colourSpace: "rgb",
          }
        }
        quality={0.5}
        parallax={0.35}
        windowPointer
      />
      {custom.value && (
        <div
          style={{
            position: "absolute",
            inset: "0",
            background: "rgba(241,236,226,0.90)",
          }}
        />
      )}
      <DraftingGrid />
    </div>
  );
});
