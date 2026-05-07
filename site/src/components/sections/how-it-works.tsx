import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { grid, vstack } from "styled-system/patterns";

const steps = [
  {
    icon: "👤",
    num: "01",
    title: "Define Persona",
    desc: "Map their culture, influences, obsessions, and aesthetic DNA. Go deeper than demographics.",
  },
  {
    icon: "✨",
    num: "02",
    title: "Generate Prompts",
    desc: "AI transforms persona data into optimized prompts for SVG, image, and video generation.",
  },
  {
    icon: "🧬",
    num: "03",
    title: "QD Evolution",
    desc: "Quality Diversity algorithms explore the design space, maintaining diverse high-quality options.",
  },
  {
    icon: "⚖️",
    num: "04",
    title: "LLM Judge",
    desc: "An AI critic evaluates each asset against the persona's taste profile for alignment.",
  },
];

export const HowItWorksSection = component$(() => {
  return (
    <section id="how-it-works" class={css({ py: 32, position: "relative" })}>
      <div class={css({ maxW: "6xl", mx: "auto", px: 6 })}>
        <div class={vstack({ gap: 4, textAlign: "center", mb: 20 })}>
          <h2
            class={css({
              fontFamily: "heading",
              fontSize: { base: "3xl", md: "4xl", lg: "5xl" },
              fontWeight: "bold",
            })}
          >
            How Baste Works
          </h2>
          <p
            class={css({
              fontSize: "lg",
              color: "text-muted",
              maxW: "xl",
            })}
          >
            A full pipeline from persona definition to production-ready assets.
          </p>
        </div>

        <div
          class={grid({
            columns: { base: 1, md: 2, lg: 4 },
            gap: 6,
          })}
        >
          {steps.map((step) => (
            <div
              key={step.num}
              class={css({
                p: 6,
                rounded: "2xl",
                bg: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                _hover: { bg: "rgba(255,255,255,0.04)" },
                transition: "all 0.2s",
              })}
            >
              <div
                class={css({
                  w: 12,
                  h: 12,
                  rounded: "xl",
                  bgGradient: "to-br",
                  gradientFrom: "rgba(249,115,22,0.2)",
                  gradientTo: "rgba(217,119,6,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "2xl",
                  mb: 4,
                })}
              >
                {step.icon}
              </div>
              <div
                class={css({
                  fontSize: "xs",
                  fontFamily: "mono",
                  color: "orange.400",
                  mb: 2,
                })}
              >
                {step.num}
              </div>
              <h3
                class={css({
                  fontFamily: "heading",
                  fontSize: "xl",
                  fontWeight: "bold",
                  mb: 2,
                })}
              >
                {step.title}
              </h3>
              <p
                class={css({
                  fontSize: "sm",
                  color: "rgba(255,255,255,0.4)",
                  lineHeight: "relaxed",
                })}
              >
                {step.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Architecture diagram */}
        <div
          class={css({
            mt: 20,
            p: 8,
            rounded: "2xl",
            bg: "#111",
            border: "1px solid rgba(255,255,255,0.05)",
          })}
        >
          <div class={vstack({ gap: 2, textAlign: "center", mb: 8 })}>
            <h3
              class={css({
                fontFamily: "heading",
                fontSize: "2xl",
                fontWeight: "bold",
              })}
            >
              Architecture
            </h3>
            <p class={css({ fontSize: "sm", color: "rgba(255,255,255,0.4)" })}>
              Persona → QD Engine → Assets
            </p>
          </div>
          <div
            class={grid({
              columns: 5,
              gap: 4,
              textAlign: "center",
              alignItems: "center",
            })}
          >
            <div
              class={css({
                p: 4,
                rounded: "xl",
                bg: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.05)",
              })}
            >
              <div class={css({ fontSize: "2xl", mb: 2 })}>👤</div>
              <div class={css({ fontSize: "sm", fontWeight: "medium" })}>Persona</div>
              <div class={css({ fontSize: "xs", color: "rgba(255,255,255,0.3)", mt: 1 })}>Cultural DNA</div>
            </div>
            <div class={css({ color: "rgba(255,255,255,0.2)", fontSize: "2xl" })}>→</div>
            <div
              class={css({
                p: 4,
                rounded: "xl",
                bg: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.05)",
              })}
            >
              <div class={css({ fontSize: "2xl", mb: 2 })}>🧬</div>
              <div class={css({ fontSize: "sm", fontWeight: "medium" })}>QD Engine</div>
              <div class={css({ fontSize: "xs", color: "rgba(255,255,255,0.3)", mt: 1 })}>MAP-Elites</div>
            </div>
            <div class={css({ color: "rgba(255,255,255,0.2)", fontSize: "2xl" })}>→</div>
            <div
              class={css({
                p: 4,
                rounded: "xl",
                bgGradient: "to-br",
                gradientFrom: "rgba(249,115,22,0.1)",
                gradientTo: "rgba(217,119,6,0.1)",
                border: "1px solid rgba(249,115,22,0.2)",
              })}
            >
              <div class={css({ fontSize: "2xl", mb: 2 })}>🎨</div>
              <div class={css({ fontSize: "sm", fontWeight: "medium" })}>Assets</div>
              <div
                class={css({
                  fontSize: "xs",
                  color: "rgba(249,115,22,0.6)",
                  mt: 1,
                })}
              >
                SVG · Image · Video
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
});
