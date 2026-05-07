import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { grid } from "styled-system/patterns";

const features = [
  { icon: "🎨", title: "SVG Icons & Illustrations", desc: "Scalable vector assets via QuiverAI integration" },
  { icon: "🖼️", title: "Hero Images", desc: "High-quality images via GPT Image 2 / DALL-E 3" },
  { icon: "🎬", title: "Video Loops", desc: "Short cinematic backgrounds via Veo 3" },
  { icon: "🎨", title: "Design Tokens", desc: "CSS variables, Tailwind configs, JSON exports" },
  { icon: "📚", title: "QD Archive", desc: "Diverse asset library organized by feature space" },
  { icon: "⚖️", title: "LLM Evaluation", desc: "Automated quality assessment against persona" },
];

export const FeaturesSection = component$(() => {
  return (
    <section class={css({ py: 32, position: "relative" })}>
      <div class={css({ maxW: "6xl", mx: "auto", px: 6 })}>
        <h2
          class={css({
            fontFamily: "heading",
            fontSize: "4xl",
            fontWeight: "bold",
            mb: 12,
            textAlign: "center",
          })}
        >
          What You Get
        </h2>

        <div
          class={grid({
            columns: { base: 1, md: 2, lg: 3 },
            gap: 6,
          })}
        >
          {features.map((f) => (
            <div
              key={f.title}
              class={css({
                p: 6,
                rounded: "xl",
                bg: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.05)",
                _hover: { bg: "rgba(255,255,255,0.04)" },
                transition: "all 0.2s",
              })}
            >
              <div class={css({ fontSize: "3xl", mb: 3 })}>{f.icon}</div>
              <h3
                class={css({
                  fontFamily: "heading",
                  fontSize: "lg",
                  fontWeight: "semibold",
                  mb: 2,
                })}
              >
                {f.title}
              </h3>
              <p
                class={css({
                  fontSize: "sm",
                  color: "rgba(255,255,255,0.4)",
                })}
              >
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
