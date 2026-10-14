import { component$, useSignal, useTask$, useVisibleTask$, type NoSerialize, noSerialize } from "@builder.io/qwik";
import type { ShaderInstance, PresetConfig } from "shaders/js";

/** One layer of a shaders.com composition (see https://shaders.com/docs). */
export interface ShaderLayer {
  type: string;
  id: string;
  props?: Record<string, unknown>;
}

interface ShaderCanvasProps {
  layers: ShaderLayer[];
  /** Painted underneath, and all that shows without WebGPU or under reduced motion. */
  fallback: string;
  class?: string;
  /** Props pushed into a layer after mount, e.g. a persona's palette. */
  live?: Record<string, Record<string, unknown>>;
}

/**
 * A shaders.com composition in a canvas. The WebGPU engine is only
 * fetched once the canvas nears the viewport, and is skipped entirely without
 * WebGPU or under reduced motion; the CSS `fallback` ground stays in place, so
 * the section reads the same either way. Decorative: hidden from assistive tech
 * and never takes pointer events.
 */
export const ShaderCanvas = component$<ShaderCanvasProps>(({ layers, fallback, class: cls, live }) => {
  const canvas = useSignal<HTMLCanvasElement>();
  const instance = useSignal<NoSerialize<ShaderInstance>>();
  const ready = useSignal(false);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(
    async ({ cleanup }) => {
      const cv = canvas.value;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (!cv || reduced.matches || !("gpu" in navigator)) return;
      let disposed = false;
      const onMotion = () => {
        if (reduced.matches) { instance.value?.pause(); ready.value = false; }
        else if (instance.value && !instance.value.getFailureReason()) { instance.value.resume(); ready.value = true; }
      };
      cleanup(() => {
        disposed = true;
        reduced.removeEventListener("change", onMotion);
        instance.value?.destroy();
      });
      const engine = await import("shaders/js").catch(() => null);
      if (!engine || disposed || !engine.isWebGPUSupported()) return;
      const { createShader } = engine;
      const shader = await createShader(
        cv,
        { components: layers.map((l) => ({ type: l.type, id: l.id, props: l.props ?? {} })) } satisfies PresetConfig,
        { disableTelemetry: true, onReady: () => { if (!disposed) ready.value = !reduced.matches; }, onError: () => { if (!disposed) ready.value = false; } },
      ).catch(() => null);
      if (!shader) return;
      if (disposed) return shader.destroy();
      instance.value = noSerialize(shader);
      reduced.addEventListener("change", onMotion);
      onMotion();
    },
    { strategy: "intersection-observer" },
  );

  useTask$(({ track }) => {
    const next = track(() => live);
    const shader = track(() => instance.value);
    if (!shader || !next) return;
    for (const [id, props] of Object.entries(next)) shader.update(id, props);
  });

  return (
    <div aria-hidden="true" data-shader-state={ready.value ? "ready" : "fallback"} class={cls} style={{ position: "absolute", inset: 0, background: fallback, pointerEvents: "none", overflow: "hidden" }}>
      <canvas
        ref={canvas}
        style={{ width: "100%", height: "100%", display: "block", opacity: ready.value ? 1 : 0, transition: "opacity 900ms var(--ease-thread)" }}
      />
    </div>
  );
});
