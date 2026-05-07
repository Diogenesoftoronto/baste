import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { grid, hstack, vstack } from "styled-system/patterns";

export const WhySection = component$(() => {
  return (
    <section class={css({ py: 32, position: "relative" })}>
      <div class={css({ maxW: "6xl", mx: "auto", px: 6 })}>
        <div
          class={grid({
            columns: { md: 2 },
            gap: 16,
            alignItems: "center",
          })}
        >
          <div>
            <h2
              class={css({
                fontFamily: "heading",
                fontSize: { base: "3xl", md: "4xl", lg: "5xl" },
                fontWeight: "bold",
                lineHeight: 1.2,
                textWrap: "balance",
                mb: 6,
              })}
            >
              The opposite of generic isn't premium.{" "}
              <span class={css({ color: "orange.400" })}>It's personal.</span>
            </h2>
            <p
              class={css({
                fontSize: "lg",
                color: "text-muted",
                lineHeight: "relaxed",
                mb: 6,
              })}
            >
              Every app looks the same because we design for abstractions —
              "users", "personas", "demographics". Baste designs for{" "}
              <em>people</em>. Real people with obsessions, subcultures, and 2am
              rabbit holes.
            </p>
            <p
              class={css({
                fontSize: "lg",
                color: "text-muted",
                lineHeight: "relaxed",
              })}
            >
              When you know someone's influences — the films that made them cry,
              the albums they played on repeat — you can create interfaces that
              feel like they came from that person's head.
            </p>
          </div>

          <div class={vstack({ gap: 4, alignItems: "stretch" })}>
            <div
              class={css({
                p: 6,
                rounded: "xl",
                bg: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.05)",
              })}
            >
              <div class={hstack({ gap: 3, mb: 3 })}>
                <div
                  class={css({
                    w: 10,
                    h: 10,
                    rounded: "lg",
                    bg: "rgba(239,68,68,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "danger",
                    fontSize: "lg",
                  })}
                >
                  ✕
                </div>
                <span
                  class={css({
                    fontWeight: "semibold",
                    color: "rgba(255,255,255,0.7)",
                  })}
                >
                  Generic SaaS UI
                </span>
              </div>
              <div class={hstack({ gap: 2, flexWrap: "wrap" })}>
                {["Inter font", "Blue buttons", "White cards", "Subtle shadows", "Minimal icons"].map((tag) => (
                  <span
                    key={tag}
                    class={css({
                      px: 2,
                      py: 1,
                      rounded: "sm",
                      bg: "rgba(255,255,255,0.05)",
                      color: "rgba(255,255,255,0.3)",
                      fontSize: "xs",
                    })}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div
              class={css({
                p: 6,
                rounded: "xl",
                bgGradient: "to-br",
                gradientFrom: "rgba(249,115,22,0.1)",
                gradientTo: "rgba(217,119,6,0.1)",
                border: "1px solid rgba(249,115,22,0.2)",
              })}
            >
              <div class={hstack({ gap: 3, mb: 3 })}>
                <div
                  class={css({
                    w: 10,
                    h: 10,
                    rounded: "lg",
                    bg: "rgba(34,197,94,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "success",
                    fontSize: "lg",
                  })}
                >
                  ✓
                </div>
                <span
                  class={css({
                    fontWeight: "semibold",
                    color: "rgba(255,255,255,0.9)",
                  })}
                >
                  Persona-Driven UI
                </span>
              </div>
              <div class={hstack({ gap: 2, flexWrap: "wrap" })}>
                {[
                  "Handcrafted typography",
                  "Warm earth palette",
                  "Organic edges",
                  "Textured surfaces",
                  "Cultural references",
                ].map((tag) => (
                  <span
                    key={tag}
                    class={css({
                      px: 2,
                      py: 1,
                      rounded: "sm",
                      bg: "rgba(249,115,22,0.1)",
                      color: "orange.300",
                      fontSize: "xs",
                    })}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
