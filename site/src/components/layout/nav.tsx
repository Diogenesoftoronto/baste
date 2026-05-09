import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { flex, hstack } from "styled-system/patterns";
import { BasteLogo } from "./baste-logo";

export const Nav = component$(() => {
  return (
    <nav
      class={css({
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        bg: "rgba(10,10,18,0.85)",
        backdropBlur: "xl",
        borderBottom: "2px solid",
        borderColor: "electric-purple",
        boxShadow: "0 4px 0 rgba(138,0,255,0.3)",
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
        <a href="/" class={hstack({ gap: 2, textDecoration: "none" })}>
          <BasteLogo size={40} withWord />
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
            { label: "Studio", href: "/gui" },
            { label: "GitHub", href: "https://github.com/diogeneshamilton/baste" },
          ].map((link) => (
            <a
              key={link.label}
              href={link.href}
              target={link.href.startsWith("http") ? "_blank" : undefined}
              class={css({
                color: "text-muted",
                fontWeight: "semibold",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                _hover: { color: "acid-lime", textShadow: "0 0 12px rgba(198,255,0,0.7)" },
                transition: "all 0.2s",
              })}
            >
              {link.label}
            </a>
          ))}
          <a
            href="/gui"
            class={css({
              px: 5,
              py: 2,
              rounded: "lg",
              bg: "acid-lime",
              color: "ink-black",
              fontSize: "sm",
              fontWeight: "bold",
              fontFamily: "graffiti",
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
            Start Co-creating »
          </a>
        </div>
      </div>
    </nav>
  );
});
