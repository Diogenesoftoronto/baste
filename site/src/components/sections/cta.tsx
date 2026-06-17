import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { hstack, vstack } from "styled-system/patterns";

export const CTASection = component$(() => {
  return (
    <section id="try" class={css({ py: 32, position: "relative" })}>
      <div
        class={css({
          position: "absolute",
          inset: 0,
          bgGradient: "to-t",
          gradientFrom: "rgba(138,0,255,0.12)",
          gradientTo: "transparent",
        })}
      />
      <div
        class={vstack({
          position: "relative",
          maxW: "3xl",
          mx: "auto",
          px: 6,
          textAlign: "center",
          gap: 10,
        })}
      >
        <h2
          class={css({
            fontFamily: "heading",
            fontSize: { base: "3xl", md: "4xl", lg: "5xl" },
            fontWeight: "bold",
          })}
        >
          Stop building <span class={css({ color: "rgba(255,255,255,0.3)" })}>boring</span>{" "}
          interfaces.
        </h2>
        <p
          class={css({
            fontSize: "xl",
            color: "text-muted",
          })}
        >
          Your users aren't abstractions. They're people with obsessions,
          subcultures, and taste. Design for the person, not the persona
          document.
        </p>

        <div class={hstack({ gap: 4, flexWrap: "wrap", justify: "center" })}>
          <a
            href="https://github.com/diogeneshamilton/baste"
            target="_blank"
            class={css({
              px: 8,
              py: 4,
              rounded: "lg",
              bg: "acid-lime",
              color: "ink-black",
              fontFamily: "graffiti",
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              border: "2px solid",
              borderColor: "ink-black",
              boxShadow: "drip",
              transition: "all 0.15s",
              _hover: {
                bg: "neon-fuchsia",
                color: "off-white",
                transform: "translate(-2px,-2px)",
                boxShadow: "6px 8px 0 #0A0A0A",
              },
            })}
          >
            View on GitHub
          </a>
          <a
            href="https://www.npmjs.com/package/baste"
            target="_blank"
            class={css({
              px: 8,
              py: 4,
              rounded: "lg",
              bg: "rgba(255,255,255,0.05)",
              border: "2px solid",
              borderColor: "electric-purple",
              color: "text",
              fontWeight: "semibold",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              transition: "all 0.2s",
              _hover: {
                bg: "rgba(138,0,255,0.15)",
                color: "acid-lime",
                boxShadow: "0 0 18px rgba(138,0,255,0.5)",
              },
            })}
          >
            npm install
          </a>
        </div>

        <div
          class={css({
            mt: 16,
            p: 6,
            rounded: "2xl",
            bg: "#111",
            border: "1px solid rgba(255,255,255,0.05)",
            textAlign: "left",
          })}
        >
          <div
            class={hstack({
              gap: 3,
              fontSize: "sm",
              color: "rgba(255,255,255,0.3)",
              mb: 3,
            })}
          >
            <span
              class={css({
                w: 2,
                h: 2,
                rounded: "full",
                bg: "success",
              })}
            />
            baste installed successfully
          </div>
          <div
            class={css({
              fontFamily: "mono",
              fontSize: "sm",
              color: "rgba(255,255,255,0.6)",
            })}
          >
            <div>
              <span class={css({ color: "success" })}>$</span>{" "}
              <span class={css({ color: "text" })}>baste list</span>
            </div>
            <div class={css({ color: "rgba(255,255,255,0.3)" })}>
              {"  "}cyberbotanist — The Cyberbotanist
            </div>
            <div class={css({ color: "rgba(255,255,255,0.3)" })}>
              {"  "}nightmarketcoder — The Night Market Coder
            </div>
            <div class={css({ color: "rgba(255,255,255,0.3)" })}>
              {"  "}liminalweeb — The Liminal Weeb
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
