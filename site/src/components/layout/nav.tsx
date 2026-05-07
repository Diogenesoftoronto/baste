import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { flex, hstack } from "styled-system/patterns";

export const Nav = component$(() => {
  return (
    <nav
      class={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        bg: "rgba(10,10,15,0.8)",
        backdropBlur: "xl",
        borderBottom: "1px solid token(colors.border)",
      })}
    >
      <div
        class={flex({
          maxW: "7xl",
          mx: "auto",
          px: 6,
          h: 16,
          align: "center",
          justify: "space-between",
        })}
      >
        <a href="/" class={hstack({ gap: 3 })}>
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
              fontSize: "lg",
            })}
          >
            Baste
          </span>
        </a>

        <div
          class={hstack({
            gap: 8,
            fontSize: "sm",
            display: { base: "none", md: "flex" },
          })}
        >
          {[
            { label: "Personas", href: "#personas" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Install", href: "#installation" },
            { label: "GitHub", href: "https://github.com/diogeneshamilton/baste" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              class={css({
                color: "text-muted",
                _hover: { color: "text" },
                transition: "color 0.2s",
              })}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#installation"
            class={css({
              px: 4,
              py: 2,
              rounded: "lg",
              bg: "surface-hover",
              color: "text",
              fontSize: "sm",
              fontWeight: "medium",
              _hover: { bg: "border" },
              transition: "all 0.2s",
            })}
          >
            Get Started
          </a>
        </div>
      </div>
    </nav>
  );
});
