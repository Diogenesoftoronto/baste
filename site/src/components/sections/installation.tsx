import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { hstack, vstack } from "styled-system/patterns";

const steps = [
  {
    num: "1",
    title: "Install via npm",
    lang: "bash",
    code: "npm install -g baste",
  },
  {
    num: "2",
    title: "Set up API keys",
    lang: ".env",
    code: "OPENAI_API_KEY=sk-...\nQUIVER_API_KEY=qv-...\nGOOGLE_API_KEY=AIza... (optional)",
  },
  {
    num: "3",
    title: "Generate your first assets",
    lang: "bash",
    code: "baste generate cyberbotanist --dry-run\n\nbaste generate cyberbotanist\n\nbaste tokens cyberbotanist --format css",
  },
  {
    num: "4",
    title: "Use as a library",
    lang: "TypeScript",
    code: 'import { getPersona, generateUIKit } from "baste";\n\nconst persona = getPersona("cyberbotanist");\nconst kit = await generateUIKit(persona, config);\n\n// kit.assets.images, kit.assets.svgs, kit.archive',
  },
];

export const InstallationSection = component$(() => {
  return (
    <section id="installation" class={css({ py: 32, position: "relative" })}>
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
      <div class={css({ position: "relative", maxW: "4xl", mx: "auto", px: 6 })}>
        <div class={vstack({ gap: 4, textAlign: "center", mb: 16 })}>
          <h2
            class={css({
              fontFamily: "heading",
              fontSize: { base: "3xl", md: "4xl", lg: "5xl" },
              fontWeight: "bold",
            })}
          >
            Get Started
          </h2>
          <p class={css({ fontSize: "lg", color: "text-muted" })}>
            Install Baste and generate your first persona-driven assets.
          </p>
        </div>

        <div class={vstack({ gap: 8, alignItems: "stretch" })}>
          {steps.map((step) => (
            <div
              key={step.num}
              class={css({
                rounded: "2xl",
                bg: "#111",
                border: "1px solid rgba(255,255,255,0.05)",
                overflow: "hidden",
              })}
            >
              <div
                class={hstack({
                  gap: 3,
                  px: 6,
                  py: 4,
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                })}
              >
                <div
                  class={css({
                    w: 8,
                    h: 8,
                    rounded: "lg",
                    bg: "rgba(249,115,22,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "sm",
                    fontWeight: "bold",
                    color: "orange.400",
                  })}
                >
                  {step.num}
                </div>
                <span class={css({ fontWeight: "semibold" })}>{step.title}</span>
              </div>
              <div
                class={css({
                  p: 6,
                  fontFamily: "mono",
                  fontSize: "sm",
                })}
              >
                <div
                  class={css({
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    color: "rgba(255,255,255,0.3)",
                    fontSize: "xs",
                    mb: 2,
                  })}
                >
                  {step.lang}
                </div>
                <pre
                  class={css({
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    lineHeight: "relaxed",
                  })}
                >
                  {step.code.split("\n").map((line, i) => (
                    <span key={i} class={css({ display: "block" })}>
                      {line.startsWith("import") || line.startsWith("const") ? (
                        <span>
                          <span class={css({ color: "purple.400" })}>import</span>{" "}
                          <span class={css({ color: "text" })}>{"{"}</span>{" "}
                          <span class={css({ color: "text" })}>getPersona, generateUIKit</span>{" "}
                          <span class={css({ color: "purple.400" })}>from</span>{" "}
                          <span class={css({ color: "amber.400" })}>&quot;baste&quot;</span>
                          <span class={css({ color: "text" })}>;</span>
                        </span>
                      ) : line.startsWith("// ") ? (
                        <span class={css({ color: "rgba(255,255,255,0.4)" })}>{line}</span>
                      ) : line.includes("=") && line.includes("(") ? (
                        <span>
                          <span class={css({ color: "purple.400" })}>const</span>{" "}
                          <span class={css({ color: "text" })}>{line.split("=")[0]}</span>
                          <span class={css({ color: "purple.400" })}>=</span>
                          <span class={css({ color: "purple.400" })}>await</span>{" "}
                          <span class={css({ color: "text" })}>{line.split("=")[1]?.replace("await ", "")}</span>
                        </span>
                      ) : line.startsWith("baste") || line.startsWith("npm") ? (
                        <span>
                          <span class={css({ color: "success" })}>baste</span>{" "}
                          <span class={css({ color: "text" })}>{line.replace("baste ", "")}</span>
                        </span>
                      ) : line.includes("=") ? (
                        <span>
                          <span class={css({ color: "blue.400" })}>{line.split("=")[0]}</span>
                          <span class={css({ color: "text" })}>=</span>
                          <span class={css({ color: "text" })}>{line.split("=")[1]}</span>
                        </span>
                      ) : (
                        <span class={css({ color: "text" })}>{line}</span>
                      )}
                    </span>
                  ))}
                </pre>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});
