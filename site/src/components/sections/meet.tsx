import { component$ } from "@builder.io/qwik";
import { Conversation } from "~/components/converse/conversation";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

export const MeetSection = component$(() => (
  <section id="meet" aria-labelledby="meet-title" class="meet-section" data-scroll>
    <div class="stitch-rule" aria-hidden="true" />
    <div class="meet-layout">
      <header class="meet-intro">
        <h2 id="meet-title" class="display" data-words>A person to design with.</h2>
        <p>Meet Moss, Ren, and Ada. Ask what they notice, what they love, and what would make a design feel like theirs.</p>
      </header>
      <Conversation personas={DEMO_PERSONAS} tokens={DEMO_TOKENS} />
    </div>
  </section>
));
