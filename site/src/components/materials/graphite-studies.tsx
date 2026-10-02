import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
const studies = [
  {
    id: "chromatic-bath",
    name: "Chromatic bath",
    description:
      "Warm dye moves through a warped field. A cyclic colour ramp changes the light without replacing the composition.",
    motion: true,
  },
  {
    id: "chalk-strata",
    name: "Chalk strata",
    description:
      "A repeated blue-and-paper ramp traces the same height field many times, building a landscape of contours.",
    motion: false,
  },
  {
    id: "radial-dye",
    name: "Radial dye",
    description:
      "A dyed strip repeats around a centre. Colour and rotation share a clock, so the whole fan turns together.",
    motion: true,
  },
  {
    id: "interference-weave",
    name: "Interference weave",
    description:
      "Two slightly rotated arrays create a slower rhythm where their threads cross. Small changes make large bands.",
    motion: false,
  },
];
const link = css({
  fontSize: "13px",
  color: "thread-ink",
  textUnderlineOffset: "3px",
});
export const GraphiteStudies = component$(() => (
  <section aria-labelledby="graphite-studies" class={css({ mt: 16 })}>
    <p class="label">From the Graphite workbench</p>
    <h2
      id="graphite-studies"
      class={css({
        fontFamily: "display",
        fontSize: { base: "32px", md: "42px" },
        fontWeight: 500,
        mt: 3,
        mb: 4,
      })}
    >
      Four more ways to find a pattern.
    </h2>
    <p
      class={css({
        maxW: "640px",
        fontSize: "14px",
        color: "ink-muted",
        lineHeight: 1.6,
        mb: 8,
      })}
    >
      Native Graphite studies, selected from twenty variations. Download a
      drawing to explore its nodes in Graphite, or open a motion study to see
      the colours travel.
    </p>
    <div
      class={css({
        display: "grid",
        gridTemplateColumns: {
          base: "minmax(0,1fr)",
          md: "repeat(2,minmax(0,1fr))",
        },
        gap: { base: 8, md: 10 },
      })}
    >
      {studies.map((s) => (
        <article key={s.id}>
          <img
            src={`/materials/graphite/${s.id}.webp`}
            width="1024"
            height="640"
            loading="lazy"
            alt={s.name}
            class={css({
              w: "100%",
              h: "auto",
              display: "block",
              border: "1px solid token(colors.rule)",
            })}
          />
          <h3
            class={css({
              fontFamily: "display",
              fontWeight: 500,
              fontSize: "26px",
              mt: 4,
              mb: 2,
            })}
          >
            {s.name}
          </h3>
          <p
            class={css({
              fontSize: "14px",
              color: "ink-muted",
              lineHeight: 1.6,
              maxW: "480px",
            })}
          >
            {s.description}
          </p>
          <div
            class={css({ display: "flex", flexWrap: "wrap", gap: 5, mt: 3 })}
          >
            <a
              class={link}
              href={`/materials/graphite/${s.id}.graphite`}
              download
            >
              Download Graphite drawing
            </a>
            {(s.id === "radial-dye" || s.id === "interference-weave") && <a class={link} href={`/materials/graphite/${s.id}.svg`} download>Download SVG</a>}
            {s.motion && (
              <>
                <a
                  class={link}
                  href={`/materials/graphite/${s.id}-loop.gif`}
                  target="_blank"
                  rel="noopener"
                >
                  Open motion study
                </a>
                <a
                  class={link}
                  href={`/materials/graphite/${s.id}-loop.graphite`}
                  download
                >
                  Animated drawing
                </a>
              </>
            )}
            {s.id === "radial-dye" && (
              <a
                class={link}
                href="/materials/graphite/radial-dye-pointer.graphite"
                download
              >
                Pointer-driven drawing
              </a>
            )}
          </div>
        </article>
      ))}
    </div>
  </section>
));
