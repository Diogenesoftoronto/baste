import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { grid, hstack, vstack } from "styled-system/patterns";

const personas = [
  {
    icon: "🍄",
    name: "The Cyberbotanist",
    summary:
      "A biologist who studies fungi networks by day, programs LED grow systems by night. Believes technology should feel organic and alive.",
    influences: ["Mushishi", "Ernst Haeckel", "Solarpunk", "Bioluminescence"],
    aesthetic: [
      { icon: "🎨", label: "Warm", color: "#8B6914" },
      { icon: "📐", label: "Organic", color: "#6B8E6B" },
      { icon: "✨", label: "Rich", color: "#D4A843" },
    ],
    bg: "#F5F0E8",
    text: "#2D2926",
    accent: "#8B6914",
  },
  {
    icon: "🌃",
    name: "The Night Market Coder",
    summary:
      "A developer who grew up in East Asian night markets. Loves chaos, density, and the humanity of crowded spaces.",
    influences: ["Chungking Express", "City Pop", "Neon", "Yakuza"],
    aesthetic: [
      { icon: "🎨", label: "Warm", color: "orange.400" },
      { icon: "📐", label: "Geometric", color: "yellow.400" },
      { icon: "✨", label: "Maximal", color: "amber.400" },
    ],
    bg: "#0A0A0A",
    text: "white",
    accent: "orange.500",
  },
  {
    icon: "🌀",
    name: "The Liminal Weeb",
    summary:
      "Designer obsessed with liminal spaces, 90s web aesthetics, and digital decay. Finds beauty in forgotten corners of the internet.",
    influences: ["Lain", "Vaporwave", "Glitch Art", "Old Web"],
    aesthetic: [
      { icon: "🎨", label: "Cool", color: "blue.400" },
      { icon: "📐", label: "Soft", color: "purple.400" },
      { icon: "✨", label: "Minimal", color: "cyan.400" },
    ],
    bg: "#1A1F2E",
    text: "#E8E8F0",
    accent: "blue.500",
  },
];

export const PersonasSection = component$(() => {
  return (
    <section id="personas" class={css({ py: 32, position: "relative" })}>
      <div
        class={css({
          position: "absolute",
          inset: 0,
          bgGradient: "to-b",
          gradientFrom: "transparent",
          gradientVia: "rgba(249,115,22,0.05)",
          gradientTo: "transparent",
        })}
      />
      <div class={css({ position: "relative", maxW: "7xl", mx: "auto", px: 6 })}>
        <div class={vstack({ gap: 4, textAlign: "center", mb: 20 })}>
          <h2
            class={css({
              fontFamily: "heading",
              fontSize: { base: "3xl", md: "4xl", lg: "5xl" },
              fontWeight: "bold",
            })}
          >
            Meet the Personas
          </h2>
          <p
            class={css({
              fontSize: "lg",
              color: "text-muted",
              maxW: "xl",
            })}
          >
            Each persona is a complete cultural entity with influences,
            obsessions, and an aesthetic DNA that drives every design decision.
          </p>
        </div>

        <div
          class={grid({
            columns: { base: 1, md: 3 },
            gap: 6,
          })}
        >
          {personas.map((p) => (
            <div
              key={p.name}
              class={css({
                position: "relative",
                rounded: "2xl",
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.05)",
                bg: p.bg,
                color: p.text,
                cursor: "pointer",
                transition: "transform 0.5s",
                _hover: { transform: "scale(1.02)" },
              })}
            >
              <div
                class={css({
                  position: "absolute",
                  inset: 0,
                  bgGradient: "to-br",
                  gradientFrom: `${p.accent}10`,
                  gradientTo: `${p.accent}10`,
                })}
              />
              <div class={css({ position: "relative", p: 8 })}>
                <div
                  class={css({
                    w: 12,
                    h: 12,
                    rounded: "xl",
                    bg: `${p.accent}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2xl",
                    mb: 6,
                  })}
                >
                  {p.icon}
                </div>
                <h3
                  class={css({
                    fontFamily: "heading",
                    fontSize: "2xl",
                    fontWeight: "bold",
                    mb: 2,
                  })}
                >
                  {p.name}
                </h3>
                <p
                  class={css({
                    fontSize: "sm",
                    opacity: 0.6,
                    mb: 6,
                    lineHeight: "relaxed",
                  })}
                >
                  {p.summary}
                </p>

                <div class={css({ mb: 6 })}>
                  <div
                    class={css({
                      fontSize: "xs",
                      fontWeight: "semibold",
                      textTransform: "uppercase",
                      letterSpacing: "wider",
                      opacity: 0.4,
                      mb: 2,
                    })}
                  >
                    Influences
                  </div>
                  <div class={hstack({ gap: 1.5, flexWrap: "wrap" })}>
                    {p.influences.map((inf) => (
                      <span
                        key={inf}
                        class={css({
                          px: 2,
                          py: 1,
                          rounded: "sm",
                          bg: `${p.accent}10`,
                          color: p.accent,
                          fontSize: "xs",
                          fontWeight: "medium",
                        })}
                      >
                        {inf}
                      </span>
                    ))}
                  </div>
                </div>

                <div class={hstack({ gap: 4, fontSize: "xs", opacity: 0.4 })}>
                  {p.aesthetic.map((a) => (
                    <span key={a.label} class={hstack({ gap: 1 })}>
                      {a.icon}{" "}
                      <span style={{ color: a.color }} class={css({ fontWeight: "medium" })}>
                        {a.label}
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
