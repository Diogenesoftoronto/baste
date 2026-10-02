import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { HeroSection } from "~/components/sections/hero";
import { MeasureSection } from "~/components/sections/measure";
import { MethodSection } from "~/components/sections/method";
import { WardrobeSection } from "~/components/sections/wardrobe";
import { DeliverablesSection } from "~/components/sections/deliverables";
import { InstallSection } from "~/components/sections/install";
import { ClosingSection } from "~/components/sections/closing";
import { PageSeam } from "~/components/fx/page-seam";

export default component$(() => {
  return (
    <>
      <Nav />
      <PageSeam />
      <main id="main">
        <HeroSection />
        <MeasureSection />
        <MethodSection />
        <WardrobeSection />
        <DeliverablesSection />
        <InstallSection />
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
        "Baste turns a persona's films, music, spaces and obsessions into a design system, icons, images and motion that fit them. Quality-diversity search, judged for persona fit.",
    },
  ],
};
