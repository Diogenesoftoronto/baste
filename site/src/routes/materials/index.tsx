import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { SmoothScroll } from "~/components/fx/smooth-scroll";
import { GraphiteStudies } from "~/components/materials/graphite-studies";
import { MaterialLab } from "~/components/materials/material-lab";
import { MaterialBolts, PersonaCloths } from "~/components/materials/material-room";

export default component$(() => (
  <>
    <Nav />
    <SmoothScroll />
    <main id="main" class={css({ maxW: "1320px", mx: "auto", px: { base: 4, md: 8 }, pb: { base: 16, md: 24 } })}>
      <MaterialBolts />
      <section id="workbench" class="mr-workbench" aria-labelledby="workbench-title">
        <header class="mr-section-head">
          <span class="label mr-kicker">The workbench</span>
          <h2 id="workbench-title" class="display">Bend it. Dye it. Keep it.</h2>
          <p>
            This cloth is live. Move across it and it bends; tap it and it ripples. Everything you change saves on this
            device. Export a still, save a recipe to share, or wear it behind Baste.
          </p>
        </header>
        <MaterialLab id="lab" />
      </section>
      <PersonaCloths />
      <GraphiteStudies />
    </main>
    <Footer />
  </>
));

export const head: DocumentHead = {
  title: "Material room · Baste",
  meta: [
    {
      name: "description",
      content:
        "Six living materials and the cloth each persona weaves from its palette. Bend, re-dye and export them as images or recipes, or open the Graphite studies behind them.",
    },
  ],
};
