import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { MeasureSection } from "~/components/sections/measure";
import { MethodSection } from "~/components/sections/method";
import { DeliverablesSection } from "~/components/sections/deliverables";
import { InstallSection } from "~/components/sections/install";
import { SmoothScroll } from "~/components/fx/smooth-scroll";
import { MethodRun } from "~/components/method/method-run";

export default component$(() => (
  <>
    <Nav />
    <SmoothScroll />
    <main id="main">
      <MethodRun />
      <nav aria-label="On this page" class={css({ maxW: "1400px", mx: "auto", px: { base: 4, md: 9 }, py: 6, display: "flex", flexWrap: "wrap", gap: { base: 4, md: 8 }, borderTop: "1px solid token(colors.rule)", fontSize: "15px", "& a": { color: "ink-soft", textDecoration: "none", _hover: { color: "thread-ink", textDecoration: "underline", textUnderlineOffset: "4px" } } })}>
        <span class={css({ fontFamily: "mono", fontSize: "11px", letterSpacing: "0.12em", textTransform: "uppercase", color: "ink-muted", alignSelf: "center" })}>On this page</span>
        <a href="#measure">Measurements</a>
        <a href="#method">Generation & scoring</a>
        <a href="#deliverables">What you get</a>
        <a href="#install">Local setup</a>
      </nav>
      <MeasureSection />
      <MethodSection />
      <DeliverablesSection />
      <InstallSection />
    </main>
    <Footer />
  </>
));

export const head: DocumentHead = {
  title: "The method · Baste",
  meta: [{ name: "description", content: "Watch a real Baste run: twenty-four drafts for one persona, placed by colour temperature and density, judged by a vision model, with the best of each direction kept. Then the measurements, scoring, files and local setup." }],
};
