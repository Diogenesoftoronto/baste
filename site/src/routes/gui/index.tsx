import { component$ } from "@builder.io/qwik";
import type { DocumentHead } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { Nav } from "~/components/layout/nav";
import { Footer } from "~/components/layout/footer";

export default component$(() => (
  <>
    <Nav />
    <main class={css({ maxW: "3xl", mx: "auto", px: 6, pt: 32, pb: 24, color: "text" })}>
      <h1 class={css({ fontSize: "3xl", fontWeight: "bold", mb: 6 })}>Run Baste Studio locally</h1>
      <p>The public site introduces Baste. Studio runs on your computer, where your personas, projects and provider credentials stay under your control.</p>
      <p class={css({ mt: 6 })}>Clone the repository and follow its installation guide:</p>
      <p class={css({ mt: 4 })}><a href="https://github.com/Diogenesoftoronto/baste#readme" class={css({ color: "acid-lime" })}>Open the Baste installation guide</a></p>
      <p class={css({ mt: 6 })}>Hosted accounts and generation are not available on this public release.</p>
      <p class={css({ mt: 6 })}><a href="/" class={css({ color: "acid-lime" })}>Back to Baste</a></p>
    </main>
    <Footer />
  </>
));

export const head: DocumentHead = { title: "Local Studio · Baste" };
