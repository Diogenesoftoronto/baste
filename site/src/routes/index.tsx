import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { HeroSection } from "~/components/sections/hero";
import { TourSection } from "~/components/sections/tour";
import { MeetSection } from "~/components/sections/meet";
import { ClosingSection } from "~/components/sections/closing";
import { PageSeam } from "~/components/fx/page-seam";
import { SmoothScroll } from "~/components/fx/smooth-scroll";

export default component$(() => {
  return (
    <>
      <Nav />
      <PageSeam />
      <SmoothScroll />
      <main id="main">
        <HeroSection />
        <TourSection />
        <MeetSection />
        <ClosingSection />
      </main>
      <Footer />
    </>
  );
});

export const head: DocumentHead = {
  title: "Baste — interfaces cut to fit one person",
  meta: [
    {
      name: "description",
      content:
        "Meet a persona, ask about their taste, and see their films, music, spaces and obsessions become an interface. Make your own fitting in Baste.",
    },
  ],
};
