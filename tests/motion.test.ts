import { test } from "node:test";
import assert from "node:assert/strict";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import { generateDesignTokens, exportCSS, exportTailwindConfig, exportPandaTheme } from "../dist/src/assets/design-system.js";
import { MOTION_LANGUAGE, MOTION_MOMENTS, exportMotionCSS, keyframesCSS, motionTokens, springEasing, springPosition, videoMotionPhrase } from "../dist/src/assets/motion.js";
import { generatePrompts } from "../dist/src/generation/prompts.js";

const styles = ["smooth", "snappy", "liquid", "mechanical"] as const;
const densities = ["minimal", "rich", "dense", "maximalist"] as const;
const ms = (value: string) => Number(value.replace(/ms$/, ""));
const px = (value: string) => Number(value.replace(/px$/, ""));

test("every motion style and density yields a complete, ordered vocabulary", () => {
  for (const motionStyle of styles) {
    for (const density of densities) {
      const m = motionTokens({ motionStyle, density });
      const durations = [m.duration.fast, m.duration.base, m.duration.slow, m.duration.slower].map(ms);
      assert.deepEqual([...durations].sort((a, b) => a - b), durations, `${motionStyle} durations ascend`);
      assert.ok(px(m.distance.nudge) < px(m.distance.shift) && px(m.distance.shift) < px(m.distance.travel));
      assert.ok(m.pressScale > 0.9 && m.pressScale < 1);
      assert.ok(ms(m.stagger) >= 10 && ms(m.ambient) >= 1000);
      assert.deepEqual(Object.keys(m.choreography).sort(), [...MOTION_MOMENTS].sort());
      for (const moment of MOTION_MOMENTS) {
        const p = m.choreography[moment];
        assert.ok(p.keyframes.length >= 2, `${motionStyle} ${moment} has keyframes`);
        assert.ok(ms(p.duration) > 0);
        assert.match(p.easing, /^(linear|cubic-bezier\(|steps\(|linear\()/);
        for (const frame of p.keyframes) if (frame.offset !== undefined) assert.ok(Number(frame.offset) > 0 && Number(frame.offset) < 1);
      }
      assert.equal(m.choreography.ambient.iterations, "infinite");
      assert.equal(m.character, MOTION_LANGUAGE[motionStyle].character);
    }
  }
});

test("denser interfaces travel less and sequence faster", () => {
  for (const motionStyle of styles) {
    const sparse = motionTokens({ motionStyle, density: "minimal" });
    const packed = motionTokens({ motionStyle, density: "maximalist" });
    assert.ok(px(sparse.distance.travel) > px(packed.distance.travel));
    assert.ok(ms(sparse.stagger) > ms(packed.stagger));
  }
});

test("springs: the liquid spring overshoots, the smooth spring does not, and both settle", () => {
  const overshoot = (stiffness: number, damping: number) => Math.max(...Array.from({ length: 2000 }, (_, i) => springPosition(i / 1000, stiffness, damping)));
  assert.ok(overshoot(120, 12) > 1.05, "liquid overshoots");
  assert.ok(overshoot(170, 26) <= 1.0001, "smooth is critically damped");
  assert.equal(springPosition(0, 120, 12), 0);
  for (const [stiffness, damping] of [[170, 26], [400, 34], [120, 12], [300, 35]]) {
    const { easing, durationMs } = springEasing(stiffness, damping);
    const stops = easing.slice("linear(".length, -1).split(", ").map(Number);
    assert.equal(stops[0], 0);
    assert.equal(stops.at(-1), 1);
    assert.ok(stops.length >= 21 && stops.length <= 61);
    assert.ok(durationMs >= 100 && durationMs <= 5000);
    assert.ok(Math.abs(1 - springPosition(durationMs / 1000, stiffness, damping)) < 0.005);
  }
});

test("the three personas move differently", () => {
  const motion = (id: "cyberbotanist" | "nightmarketcoder" | "liminalweeb") => generateDesignTokens(basePersonas[id]).motion;
  const [cyber, market, liminal] = [motion("cyberbotanist"), motion("nightmarketcoder"), motion("liminalweeb")];
  assert.ok(ms(market.choreography.enter.duration) < ms(cyber.choreography.enter.duration));
  assert.match(liminal.choreography.enter.easing, /^linear\(/, "liquid arrivals ride the spring");
  assert.ok(ms(liminal.ambient) > ms(cyber.ambient) && ms(cyber.ambient) > ms(market.ambient));
  assert.equal(market.choreography.ambient.easing, "steps(1, end)");
  assert.notEqual(cyber.character, market.character);
});

test("keyframes serialise with offsets and kebab-case properties", () => {
  const css = keyframesCSS("demo", [{ opacity: 0, borderRadius: "4px" }, { opacity: 0.5, offset: 0.25 }, { opacity: 1 }]);
  assert.match(css, /@keyframes demo \{/);
  assert.match(css, /0% \{ opacity: 0; border-radius: 4px; \}/);
  assert.match(css, /25% \{ opacity: 0\.5; \}/);
  assert.match(css, /100% \{ opacity: 1; \}/);
});

test("CSS export carries the choreography and a reduced-motion fallback", () => {
  for (const id of ["cyberbotanist", "nightmarketcoder", "liminalweeb"] as const) {
    const persona = basePersonas[id];
    const css = exportCSS(persona);
    for (const name of ["--duration-fast", "--ease-enter", "--ease-spring", "--motion-shift", "--motion-stagger", "--duration-ambient"]) assert.ok(css.includes(name), name);
    for (const cls of [".motion-enter", ".motion-exit", ".motion-hover:hover", ".motion-press:active", ".motion-emphasis", ".motion-ambient", ".motion-stagger > :nth-child(2)"]) assert.ok(css.includes(cls), cls);
    for (const name of ["baste-enter", "baste-exit", "baste-emphasis", "baste-ambient"]) assert.ok(css.includes(`@keyframes ${name} {`), name);
    const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
    assert.ok(reduced.length > 100);
    assert.match(reduced, /\.motion-emphasis, \.motion-ambient \{ animation: none; \}/);
    assert.equal(css.match(/^:root \{/gm)?.length, 1, "one :root block");
    // Braces balance, so the stylesheet parses.
    assert.equal(css.split("{").length, css.split("}").length);
  }
  const standalone = exportMotionCSS("Demo", motionTokens({ motionStyle: "liquid", density: "rich" }));
  assert.match(standalone, /^\/\* Demo — motion primitives/);
  assert.match(standalone, /:root \{\n  --duration-fast: 200ms;/);
});

test("Tailwind and Panda exports carry curves, durations and keyframes", () => {
  const persona = basePersonas.liminalweeb;
  const motion = generateDesignTokens(persona).motion;
  const tailwind = exportTailwindConfig(persona);
  for (const key of ["'enter':", "'spring':", "'slower':", "keyframes:", "animation:", "'ambient':"]) assert.ok(tailwind.includes(key), key);
  assert.ok(tailwind.includes(motion.spring.easing));
  const panda = exportPandaTheme(persona);
  for (const key of ["durations:", "easings:", "\"baste-enter\"", "\"fade-in\""]) assert.ok(panda.includes(key), key);
  // Durations and easings sit inside theme.extend.tokens, beside spacing.
  assert.ok(panda.indexOf("durations:") > panda.indexOf("spacing:") && panda.indexOf("durations:") < panda.indexOf("keyframes:"));
  assert.equal(panda.split("{").length, panda.split("}").length);
});

test("video prompts and video generators share one motion language", () => {
  for (const motionStyle of styles) {
    const persona = { ...basePersonas.cyberbotanist, aesthetic: { ...basePersonas.cyberbotanist.aesthetic, motionStyle } };
    const { video } = generatePrompts(persona, { kind: "video", purpose: "animation", description: "Spores" });
    assert.ok(video.prompt.includes(`Motion style: ${MOTION_LANGUAGE[motionStyle].character}`), motionStyle);
  }
  assert.equal(videoMotionPhrase("smooth"), "Slow, smooth movement with gentle continuous pacing");
  assert.equal(videoMotionPhrase("snappy"), "Crisp, brief motion accents with readable pauses");
});
