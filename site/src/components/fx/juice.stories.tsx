import { component$, useSignal } from "@builder.io/qwik";
import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { css } from "styled-system/css";
import { Juice, SoundToggle } from "./juice";
import { snipBurst, chalkPuff, play, type Sound } from "~/lib/juice";

const button = css({
  px: 4,
  py: 3,
  rounded: "base",
  bg: "card",
  color: "ink",
  border: "1px solid token(colors.rule)",
  boxShadow: "sheet",
 
  _hover: { borderColor: "rule-strong", transform: "translateY(-2px)" },
});
const row = css({ display: "flex", flexWrap: "wrap", gap: 3 });
const sounds: Sound[] = [
  "tick",
  "pin",
  "snip",
  "thread",
  "chalk",
  "error",
  "fanfare",
];

const JuiceLab = component$<{ pitch: number; particles: number }>(
  ({ pitch, particles }) => {
    const tension = useSignal(50);
    return (
      <section
        class={`motion ${css({ maxW: "900px", p: 8, bg: "paper", border: "1px solid token(colors.rule)", rounded: "lg", display: "flex", flexDirection: "column", gap: 7 })}`}
      >
        <Juice />
        <header
          class={css({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          })}
        >
          <div>
            <span class="label">Toy garden</span>
            <h1 class="display" style={{ fontSize: "48px", marginTop: "8px" }}>
              Juice lab
            </h1>
          </div>
          <SoundToggle />
        </header>
        <fieldset class={css({ border: 0, display: "grid", gap: 3 })}>
          <legend class="label">Delegated feedback</legend>
          <div class={row}>
            <button type="button" class={button} data-juice="snip">
              Snip thread
            </button>
            <button type="button" class={button} data-juice="pin">
              Pin a fitting
            </button>
            <button type="button" class={button} data-juice="copy">
              Copy with chalk
            </button>
          </div>
          <label for="juice-tension">Thread tension · {tension.value}%</label>
          <input
            id="juice-tension"
            type="range"
            min="0"
            max="100"
            value={tension.value}
            onInput$={(_, el) => {
              tension.value = Number(el.value);
            }}
          />
        </fieldset>
        <fieldset class={css({ border: 0, display: "grid", gap: 3 })}>
          <legend class="label">Direct particles</legend>
          <div class={row}>
            <button
              type="button"
              class={button}
              onClick$={(event, el) => {
                const r = el.getBoundingClientRect();
                snipBurst(
                  event.detail ? event.clientX : r.left + r.width / 2,
                  event.detail ? event.clientY : r.top + r.height / 2,
                  undefined,
                  particles,
                );
              }}
            >
              snipBurst()
            </button>
            <button
              type="button"
              class={button}
              onClick$={(event, el) => {
                const r = el.getBoundingClientRect();
                chalkPuff(
                  event.detail ? event.clientX : r.left + r.width / 2,
                  event.detail ? event.clientY : r.top + r.height / 2,
                  undefined,
                  particles,
                );
              }}
            >
              chalkPuff()
            </button>
          </div>
        </fieldset>
        <fieldset class={css({ border: 0, display: "grid", gap: 3 })}>
          <legend class="label">Sound palette</legend>
          <div class={row}>
            {sounds.map((sound) => (
              <button
                key={sound}
                type="button"
                class={button}
                onClick$={() => play(sound, pitch)}
              >
                {sound}
              </button>
            ))}
          </div>
        </fieldset>
      </section>
    );
  },
);

type Props = PropsOf<typeof JuiceLab>;
const meta = {
  title: "FX/Juice",
  component: JuiceLab,
  render: (args) => <JuiceLab {...args} />,
  args: { pitch: 0.5, particles: 18 },
  argTypes: {
    pitch: { control: { type: "range", min: 0, max: 1, step: 0.05 } },
    particles: { control: { type: "range", min: 1, max: 60, step: 1 } },
  },
} satisfies Meta<Props>;
export default meta;

export const Lab: StoryObj<Props> = { name: "Juice lab" };
