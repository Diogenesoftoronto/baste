import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { flex, hstack } from "styled-system/patterns";

export const Footer = component$(() => {
  return (
    <footer
      class={css({
        py: 12,
        borderTop: "1px solid token(colors.border)",
      })}
    >
      <div
        class={flex({
          maxW: "6xl",
          mx: "auto",
          px: 6,
          direction: { base: "column", md: "row" },
          align: "center",
          justify: "space-between",
          gap: 6,
        })}
      >
        <div class={hstack({ gap: 3 })}>
          <div
            class={css({
              w: 8,
              h: 8,
              rounded: "lg",
              bgGradient: "to-br",
              gradientFrom: "orange.500",
              gradientTo: "amber.600",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "sm",
              fontWeight: "bold",
            })}
          >
            B
          </div>
          <span
            class={css({
              fontFamily: "heading",
              fontWeight: "semibold",
            })}
          >
            Baste
          </span>
          <span class={css({ color: "text-muted" })}>
            — Persona-driven design generation
          </span>
        </div>

        <div class={hstack({ gap: 6, fontSize: "sm", color: "text-muted" })}>
          <a href="#" class={css({ _hover: { color: "text" }, transition: "color 0.2s" })}>
            Docs
          </a>
          <a
            href="https://github.com/diogeneshamilton/baste"
            target="_blank"
            class={css({ _hover: { color: "text" }, transition: "color 0.2s" })}
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
});
