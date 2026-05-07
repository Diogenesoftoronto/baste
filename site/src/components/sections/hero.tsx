import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { flex, hstack, vstack } from "styled-system/patterns";

export const HeroSection = component$(() => {
  return (
    <section
      class={flex({
        position: "relative",
        minH: "100vh",
        align: "center",
        justify: "center",
        overflow: "hidden",
        pt: 16,
      })}
    >
      {/* Background gradients */}
      <div
        class={css({
          position: "absolute",
          inset: 0,
          bgGradient: "to-b",
          gradientFrom: "rgba(249,115,22,0.05)",
          gradientTo: "transparent",
        })}
      />
      <div
        class={css({
          position: "absolute",
          top: "25%",
          left: "25%",
          w: "24rem",
          h: "24rem",
          bg: "rgba(249,115,22,0.1)",
          rounded: "full",
          filter: "blur(96px)",
          animation: "pulse-glow 4s ease-in-out infinite",
        })}
      />
      <div
        class={css({
          position: "absolute",
          bottom: "25%",
          right: "25%",
          w: "24rem",
          h: "24rem",
          bg: "rgba(217,119,6,0.1)",
          rounded: "full",
          filter: "blur(96px)",
          animation: "pulse-glow 4s ease-in-out infinite",
          animationDelay: "2s",
        })}
      />

      <div class={vstack({ position: "relative", maxW: "5xl", mx: "auto", px: 6, textAlign: "center", gap: 8 })}>
        <div
          class={hstack({
            gap: 2,
            px: 4,
            py: 2,
            rounded: "full",
            bg: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            fontSize: "sm",
            color: "text-muted",
          })}
        >
          <span
            class={css({
              w: 2,
              h: 2,
              rounded: "full",
              bg: "success",
              animation: "pulse 2s infinite",
            })}
          />
          v0.2.0 — Custom personas, config system, web GUI
        </div>

        <h1
          class={css({
            fontFamily: "heading",
            fontSize: { base: "4xl", md: "6xl", lg: "8xl" },
            fontWeight: "bold",
            lineHeight: 1.1,
            letterSpacing: "tight",
            textWrap: "balance",
          })}
        >
          <span
            class={css({
              bgGradient: "to-r",
              gradientFrom: "orange.400",
              gradientVia: "amber.400",
              gradientTo: "orange.500",
              bgClip: "text",
              color: "transparent",
            })}
          >
            Baste
          </span>
          <br />
          <span class={css({ color: "text" })}>Your Interface</span>
        </h1>

        <p
          class={css({
            fontSize: { base: "lg", md: "xl", lg: "2xl" },
            color: "text-muted",
            maxW: "2xl",
            textWrap: "balance",
            lineHeight: "relaxed",
          })}
        >
          Generate unique UI assets and design systems from{" "}
          <em>cultural personas</em>. Go from generic interfaces to something
          that feels like it came from{" "}
          <span class={css({ color: "orange.400" })}>someone's imagination</span>.
        </p>

        <div class={hstack({ gap: 4, flexWrap: "wrap", justify: "center" })}>
          <a
            href="#installation"
            class={css({
              px: 8,
              py: 4,
              rounded: "xl",
              bgGradient: "to-r",
              gradientFrom: "orange.500",
              gradientTo: "amber.600",
              color: "white",
              fontWeight: "semibold",
              _hover: {
                gradientFrom: "orange.400",
                gradientTo: "amber.500",
              },
              transition: "all 0.2s",
              shadow: "0 0 20px rgba(249,115,22,0.2)",
            })}
          >
            npm install baste
          </a>
          <a
            href="#personas"
            class={css({
              px: 8,
              py: 4,
              rounded: "xl",
              bg: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "text",
              fontWeight: "semibold",
              _hover: { bg: "rgba(255,255,255,0.1)" },
              transition: "all 0.2s",
            })}
          >
            See the Personas
          </a>
        </div>

        {/* Terminal mockup */}
        <div class={css({ mt: 12, maxW: "3xl", mx: "auto", w: "full" })}>
          <div
            class={css({
              rounded: "xl",
              border: "1px solid rgba(255,255,255,0.1)",
              bg: "#111",
              overflow: "hidden",
              shadow: "2xl",
            })}
          >
            <div
              class={hstack({
                gap: 2,
                px: 4,
                py: 3,
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              })}
            >
              <div class={css({ w: 3, h: 3, rounded: "full", bg: "rgba(239,68,68,0.5)" })} />
              <div class={css({ w: 3, h: 3, rounded: "full", bg: "rgba(234,179,8,0.5)" })} />
              <div class={css({ w: 3, h: 3, rounded: "full", bg: "rgba(34,197,94,0.5)" })} />
              <span
                class={css({
                  ml: 2,
                  fontSize: "xs",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "mono",
                })}
              >
                baste generate cyberbotanist --dry-run
              </span>
            </div>
            <div
              class={css({
                p: 6,
                fontFamily: "mono",
                fontSize: "sm",
                textAlign: "left",
                lineHeight: "relaxed",
              })}
            >
              <div class={css({ color: "rgba(255,255,255,0.4)" })}>
                $ <span class={css({ color: "success" })}>baste</span> generate
                cyberbotanist --dry-run
              </div>
              <div class={css({ mt: 2, color: "rgba(255,255,255,0.6)" })}>
                🔍 Dry run for{" "}
                <span class={css({ color: "orange.400" })}>The Cyberbotanist</span>
              </div>
              <div
                class={css({
                  mt: 3,
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "xs",
                })}
              >
                Image Prompt:
              </div>
              <div
                class={css({
                  mt: 1,
                  color: "rgba(255,255,255,0.8)",
                  fontSize: "xs",
                  lineHeight: "relaxed",
                  maxW: "xl",
                })}
              >
                Stunning hero image: Test asset. Style: warm earth tones with
                amber and ochre highlights, organic textured surfaces...{" "}
                <span class={css({ color: "amber.400" })}>Mushishi</span>,{" "}
                <span class={css({ color: "success" })}>Ernst Haeckel</span>,{" "}
                <span class={css({ color: "accent" })}>bioluminescent</span>...
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
