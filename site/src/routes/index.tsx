import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";
import { HeroSection } from "~/components/sections/hero";
import { WhySection } from "~/components/sections/why";
import { PersonasSection } from "~/components/sections/personas";
import { HowItWorksSection } from "~/components/sections/how-it-works";
import { InstallationSection } from "~/components/sections/installation";
import { FeaturesSection } from "~/components/sections/features";
import { CTASection } from "~/components/sections/cta";

export default component$(() => {
  return (
    <>
      <Nav />
      <main>
        <HeroSection />
        <WhySection />
        <PersonasSection />
        <HowItWorksSection />
        <InstallationSection />
        <FeaturesSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
});

export const head: DocumentHead = {
  title: "Baste — Persona-Driven Asset Generation",
  meta: [
    {
      name: "description",
      content:
        "Generate unique UI assets and design systems from cultural personas. Go from generic interfaces to something that feels like it came from someone's imagination.",
    },
  ],
};
