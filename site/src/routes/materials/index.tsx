import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { GraphiteStudies } from "~/components/materials/graphite-studies";
import { MaterialLab } from "~/components/materials/material-lab";

export default component$(() => (
  <>
    <Nav />
    <main
      id="main"
      class={css({
        maxW: "1240px",
        mx: "auto",
        px: { base: 4, md: 8 },
        pt: { base: 8, md: 12 },
      })}
    >
      <div class={css({ mb: 8, maxW: "640px" })}>
        <p class="label">The material room</p>
        <h1
          class={css({
            fontFamily: "display",
            fontSize: { base: "44px", md: "64px" },
            fontWeight: 500,
            letterSpacing: "-0.035em",
            lineHeight: 1.05,
            mt: 3,
            mb: 4,
          })}
        >
          Dye. Bend. Find a feeling.
        </h1>
        <p
          class={css({
            fontSize: "16px",
            color: "ink-muted",
            lineHeight: 1.65,
          })}
        >
          Living backgrounds you can pull, recolour, and make your own. Start
          with a study, then follow the material somewhere new.
        </p>
      </div>
      <MaterialLab />
      <GraphiteStudies />
    </main>
    <Footer />
  </>
));
export const head: DocumentHead = {
  title: "Material room — Baste",
  meta: [
    {
      name: "description",
      content:
        "Explore six interactive procedural materials, change their colours and dynamics, and export a background or reusable recipe.",
    },
  ],
};
