import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

const COLS = 7; // colour temperature: cool → warm
const ROWS = 5; // visual density: sparse → dense
const GENERATIONS = 8;

function hash(n: number): number {
  let h = 2166136261 ^ n;
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

interface Cell {
  x: number;
  y: number;
  born: number; // generation in which this niche was first filled
  score: number;
  abstract: number; // 0 literal → 1 abstract
  elite: boolean;
}

const CELLS: Cell[] = (() => {
  const cells: Cell[] = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x;
      const r = hash(i + 11);
      // niches near the persona's home region (warm, dense-ish) fill first
      const dist = Math.hypot(x - 4.5, y - 2.5) / 5;
      const born = r < 0.12 ? 99 : Math.min(GENERATIONS, 1 + Math.floor(dist * 5 + hash(i + 3) * 3));
      cells.push({ x, y, born, score: 0.52 + hash(i + 7) * 0.45, abstract: hash(i + 23), elite: false });
    }
  }
  // final archive: the best candidate in each of five spread-out regions
  const regions = [[0, 0], [3, 1], [6, 0], [1, 4], [5, 4]];
  for (const [rx, ry] of regions) {
    const near = cells
      .filter((c) => c.born <= GENERATIONS && Math.abs(c.x - rx) <= 1 && Math.abs(c.y - ry) <= 1)
      .sort((a, b) => b.score - a.score)[0];
    if (near) near.elite = true;
  }
  return cells;
})();

function tileStyle(c: Cell): Record<string, string> {
  const hue = 235 - (c.x / (COLS - 1)) * 205; // 235 (cool) → 30 (warm)
  const ground = `oklch(0.88 0.06 ${hue})`;
  const ink = `oklch(0.52 0.15 ${hue})`;
  const step = 14 - c.y * 2.4; // denser rows → tighter pattern
  return {
    background: `radial-gradient(circle at 30% 35%, ${ink} 0 ${18 + c.abstract * 14}%, transparent ${19 + c.abstract * 14}%), repeating-linear-gradient(${c.abstract > 0.5 ? 45 : 0}deg, ${ink} 0 1px, transparent 1px ${step}px), ${ground}`,
    borderRadius: `${Math.round(c.abstract * 50)}%`,
  };
}

/**
 * Quality-diversity in one picture: candidates fill niches of a
 * temperature × density map (shape = abstractness); each niche keeps its
 * best; the final archive is chosen for spread, not just score.
 */
export const QDArchive = component$(() => {
  const gen = useSignal(GENERATIONS);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gen.value = 0;
    const id = setInterval(() => {
      gen.value = gen.value >= GENERATIONS + 3 ? 0 : gen.value + 1;
    }, 650);
    cleanup(() => clearInterval(id));
  });

  const g = Math.min(gen.value, GENERATIONS);
  const done = gen.value >= GENERATIONS;
  const filled = CELLS.filter((c) => c.born <= g).length;

  return (
    <figure class={css({ display: "flex", flexDirection: "column", gap: 3, m: 0 })}>
      <div class={css({ display: "flex", justifyContent: "space-between", fontFamily: "mono", fontSize: "12px", color: "ink-muted" })}>
        <span>
          generation <strong class={css({ color: "ink" })}>{g}</strong>/{GENERATIONS}
        </span>
        <span>
          {filled}/{COLS * ROWS} niches · {done ? "5 kept" : "evolving…"}
        </span>
      </div>
      <div class={css({ display: "grid", gridTemplateColumns: "20px 1fr", gap: 2 })}>
        <span
          class={css({ writingMode: "vertical-rl", transform: "rotate(180deg)", fontFamily: "mono", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "chalk", textAlign: "center" })}
        >
          sparse → dense
        </span>
        <div
          role="img"
          aria-label="Quality-diversity archive: candidate assets spread across colour temperature and density; five diverse winners are kept."
          class={css({ display: "grid", gap: { base: "4px", sm: "6px" } })}
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {CELLS.map((c) => {
            const on = c.born <= g;
            const elite = c.elite && done;
            return (
              <div
                key={`${c.x}-${c.y}`}
                class={css({ position: "relative", aspectRatio: "1", rounded: "xs", transition: "opacity 0.4s, transform 0.5s token(easings.thread)" })}
                style={{
                  gridColumn: c.x + 1,
                  gridRow: ROWS - c.y,
                  border: on ? "1px solid rgba(28,27,25,0.12)" : "1px dashed #CFC7B8",
                  outline: elite ? "2px dashed #D2402A" : "none",
                  outlineOffset: "3px",
                  transform: on ? "scale(1)" : "scale(0.86)",
                  opacity: done && !elite ? 0.42 : 1,
                }}
              >
                {on && <div class={css({ position: "absolute", inset: "12%" })} style={tileStyle(c)} />}
                {elite && (
                  <span class={css({ position: "absolute", bottom: "2px", right: "3px", fontFamily: "mono", fontSize: "10px", color: "ink", bg: "card", px: "3px", rounded: "xs" })}>
                    {c.score.toFixed(2)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <span />
        <span class={css({ fontFamily: "mono", fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase", color: "chalk", display: "flex", justifyContent: "space-between" })}>
          <span>cool</span>
          <span>colour temperature</span>
          <span>warm</span>
        </span>
      </div>
      <figcaption class={css({ fontSize: "13px", color: "ink-muted" })}>
        Shape encodes the third axis: square tiles are literal, round ones abstract. Stitched tiles
        are the final archive — the best in each region, chosen for spread.
      </figcaption>
    </figure>
  );
});
