import { component$, useStylesScoped$ } from "@builder.io/qwik";

// Unequal intervals keep the pattern-paper ground from feeling like graph paper.
// Shared seams move independently, so the rectangles stay joined as they change.
const columns = [
  0, 46, 118, 152, 248, 306, 346, 432, 484, 598, 634, 712, 760, 858, 894, 954,
  1062, 1110, 1188, 1226, 1328, 1382, 1440,
];
const rows = [
  0, 38, 110, 158, 254, 286, 350, 394, 480, 536, 570, 672, 714, 790, 826, 918,
  962, 1000,
];

export const DraftingGrid = component$(() => {
  useStylesScoped$(`
    .drafting-grid {
      position: absolute;
      left: 50%;
      top: 50%;
      width: max(100%, 1000px);
      height: max(100%, 800px);
      transform: translate(-50%, -50%);
      pointer-events: none;
      mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 90%);
      -webkit-mask-image: radial-gradient(ellipse 80% 70% at 50% 40%, #000 30%, transparent 90%);
    }
    line {
      stroke: rgba(28, 27, 25, 0.065);
      stroke-width: 1;
      vector-effect: non-scaling-stroke;
      animation-timing-function: ease-in-out;
      animation-iteration-count: infinite;
      animation-direction: alternate;
    }
    .warp { animation-name: draft-warp; }
    .weft { animation-name: draft-weft; }
    @keyframes draft-warp {
      from { transform: translateX(-8px); }
      to { transform: translateX(8px); }
    }
    @keyframes draft-weft {
      from { transform: translateY(6px); }
      to { transform: translateY(-6px); }
    }
    @media (prefers-reduced-motion: reduce) {
      line { animation: none; }
    }
  `);

  return (
    <svg
      class="drafting-grid"
      viewBox="0 0 1440 1000"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {columns.map((x, i) => (
        <line
          key={`x-${x}`}
          class="warp"
          x1={x}
          x2={x}
          y1="-20"
          y2="1020"
          style={{
            animationDuration: `${22 + (i % 7) * 4}s`,
            animationDelay: `${-i * 5.7}s`,
          }}
        />
      ))}
      {rows.map((y, i) => (
        <line
          key={`y-${y}`}
          class="weft"
          y1={y}
          y2={y}
          x1="-20"
          x2="1460"
          style={{
            animationDuration: `${26 + (i % 5) * 5}s`,
            animationDelay: `${-i * 7.3}s`,
          }}
        />
      ))}
    </svg>
  );
});
