import { component$, useStyles$ } from "@builder.io/qwik";
import type { CandidateSummary } from "~/lib/api-types";
import styles from "./archive-map.css?inline";

/** The engine's archive axes (src/generation/qd.ts defaultAssetFeatures). */
const TEMP_BINS = 5; // colour temperature, −1 cool … 1 warm
const DENSITY_BINS = 5; // visual density, 0 sparse … 1 dense

const bin = (v: number, min: number, max: number, bins: number) =>
  Math.min(bins - 1, Math.max(0, Math.floor(((v - min) / (max - min)) * bins)));

interface ArchiveMapProps {
  candidates: CandidateSummary[];
  /** Still searching: cells show the best so far, and new arrivals pulse. */
  running?: boolean;
  /** Total candidates the run will try, when known, for the counter. */
  total?: number;
  label?: string;
}

/**
 * Quality-diversity, with the real images. Every judged candidate lands in a
 * cell of the colour-temperature × density map; each cell keeps its best.
 * The map shows what a single "best" answer would hide: the spread of
 * genuinely different directions the search found, each with its judge score.
 */
export const ArchiveMap = component$<ArchiveMapProps>(({ candidates, running = false, total, label = "Archive" }) => {
  useStyles$(styles);
  // Best candidate per cell, and how many were tried there.
  const cells = new Map<string, { best: CandidateSummary; tried: number; index: number }>();
  candidates.forEach((c, index) => {
    const key = `${bin(c.features[0], -1, 1, TEMP_BINS)}:${bin(c.features[1], 0, 1, DENSITY_BINS)}`;
    const cell = cells.get(key);
    if (!cell) cells.set(key, { best: c, tried: 1, index });
    else {
      cell.tried++;
      if (c.quality > cell.best.quality) { cell.best = c; cell.index = index; }
    }
  });
  const latest = candidates.length - 1;
  const best = candidates.reduce((m, c) => Math.max(m, c.quality), 0);
  const generation = candidates.reduce((m, c) => Math.max(m, c.generation), 0);

  return (
    <figure class="archive-map" aria-label={label}>
      <div class="archive-map-head">
        <span>
          <strong>{candidates.length}</strong>{total ? `/${total}` : ""} judged · generation <strong>{generation}</strong>
        </span>
        <span>
          <strong>{cells.size}</strong> directions kept · best <strong>{best ? best.toFixed(2) : "–"}</strong>
        </span>
      </div>
      <div class="archive-map-frame">
        <span class="archive-map-axis archive-map-axis--y" aria-hidden="true">sparse → dense</span>
        <ol class="archive-map-grid" aria-label="Kept candidates by colour temperature and density">
          {Array.from({ length: TEMP_BINS * DENSITY_BINS }, (_, i) => {
            const x = i % TEMP_BINS;
            const y = DENSITY_BINS - 1 - Math.floor(i / TEMP_BINS);
            const cell = cells.get(`${x}:${y}`);
            const warmth = x < 2 ? "cool" : x > 2 ? "warm" : "neutral";
            const density = ["very sparse", "sparse", "balanced", "dense", "very dense"][y];
            return (
              <li key={i} class="archive-map-cell" data-filled={cell ? "true" : "false"} data-fresh={running && cell?.index === latest ? "true" : undefined}>
                {cell && (
                  <>
                    <img src={cell.best.url} alt={`${warmth}, ${density} variant, judged ${Math.round(cell.best.quality * 100)}`} width={480} height={270} loading="lazy" decoding="async" />
                    <span class="archive-map-score">{cell.best.quality.toFixed(2)}</span>
                    {cell.tried > 1 && <span class="archive-map-tried" title={`${cell.tried} candidates competed for this cell`}>×{cell.tried}</span>}
                  </>
                )}
              </li>
            );
          })}
        </ol>
        <span />
        <span class="archive-map-axis archive-map-axis--x" aria-hidden="true"><span>cool</span><span>colour temperature</span><span>warm</span></span>
      </div>
    </figure>
  );
});
