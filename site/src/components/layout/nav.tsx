import { LanguageSelect, useLocale } from "~/i18n/provider";
import { text, localeHref } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { useLocation } from "@builder.io/qwik-city";
import { css } from "styled-system/css";
import { BasteLogo } from "./baste-logo";
import { SoundToggle } from "~/components/fx/juice";

export const GITHUB_URL = "https://github.com/Diogenesoftoronto/baste";

const LINKS = [
  { label: "Fitting room", href: "/#fitting" },
  { label: "Method", href: "/#method" },
  { label: "Wardrobe", href: "/#wardrobe" },
  { label: "Pattern book", href: "/specimen" },
  { label: "Materials", href: "/materials/" },
  { label: "Docs", href: "/docs/" },
];

export const Nav = component$(() => {
  const locale = useLocale();
  const loc = useLocation();
  const path = loc.url.pathname;
  return (
    <>
      <a href="#main" class="skip-link">{text(locale.value, "Skip to content")}</a>
      <header
        class={css({
          position: "sticky",
          top: 0,
          zIndex: 50,
          bg: "rgba(241,236,226,0.88)",
          backdropFilter: "saturate(1.4) blur(10px)",
          borderBottom: "1px solid token(colors.rule)",
        })}
      >
        <nav
          aria-label={text(locale.value, "Primary")}
          class={css({
            maxW: "1240px",
            mx: "auto",
            px: { base: 4, md: 8 },
            h: "60px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
          })}
        >
          <a href={localeHref("/", locale.value)} aria-label={text(locale.value, "Baste home")} class={css({ textDecoration: "none" })}>
            <BasteLogo size={26} />
          </a>

          <div class={css({ display: { base: "none", md: "flex" }, alignItems: "center", gap: 5 })}>
            {LINKS.map((l) => {
              const active = l.href.replace(/\/$/, "") === path.replace(/\/$/, "") || (l.href.startsWith("/specimen") && path.startsWith("/specimen"));
              return (
                <a
                  key={l.href}
                  href={localeHref(l.href, locale.value)}
                  aria-current={active ? "page" : undefined}
                  class={css({
                    fontSize: "14px",
                    color: "ink-soft",
                    textDecoration: "none",
                    py: 1,
                    backgroundImage: "linear-gradient(90deg, token(colors.thread) 0 6px, transparent 6px 10px)",
                    backgroundSize: "0 1.5px",
                    backgroundRepeat: "repeat-x",
                    backgroundPosition: "0 100%",
                    transition: "background-size 0.35s token(easings.thread), color 0.2s",
                    _hover: { color: "ink", backgroundSize: "10px 1.5px" },
                    "&[aria-current=page]": { color: "ink", backgroundSize: "10px 1.5px" },
                  })}
                >
                  {text(locale.value, l.label)}
                </a>
              );
            })}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener"
              class={css({ fontSize: "14px", color: "ink-soft", textDecoration: "none", _hover: { color: "ink" } })}
            >
              GitHub
            </a>
          </div>

          <div class={css({ display: "flex", alignItems: "center", gap: 2 })}>
          <LanguageSelect />
          <SoundToggle />
          <a
            href={localeHref("/gui", locale.value)}
            data-juice="snip"
            class={css({
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              px: 4,
              h: "36px",
              rounded: "base",
              bg: "ink",
              color: "paper",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "background 0.2s",
              _hover: { bg: "thread-ink" },
            })}
          >
            {text(locale.value, "Open Studio")}
            <span aria-hidden="true">→</span>
          </a>
          </div>
        </nav>
      </header>
    </>
  );
});
