import { useLocale } from "~/i18n/provider";
import { text } from "~/i18n/runtime";
import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { CopyCommand } from "~/components/ui/copy-command";
import { Section, SectionHead } from "~/components/ui/section";

const GROUPS: Array<{ t: string; rows: Array<[string, string]> }> = [
  {
    t: "Personas",
    rows: [
      ["baste list", "Every persona, base and custom"],
      ["baste show cyberbotanist", "Full measurements and aesthetic"],
      ["baste create mine --base cyberbotanist", "Extend a base persona"],
      ["baste decompose https://site.example --deep", "Draft a persona from a live site"],
      ["baste remix cyberbotanist liminalweeb --as moss-vhs", "Cross two personas"],
    ],
  },
  {
    t: "Make",
    rows: [
      ["baste generate nightmarketcoder", "Asset suite: icon, hero, background"],
      ["baste ui-kit liminalweeb", "The full UI kit"],
      ["baste tokens cyberbotanist --format css", "Tokens as css · tailwind · json"],
      ["baste gui", "The Studio, wired to your machine"],
      ["baste mcp", "Expose Baste to your agent over MCP"],
    ],
  },
  {
    t: "Version",
    rows: [
      ["baste init cyberbotanist", "Start design history"],
      ["baste update cyberbotanist colors.primary \"#a15d3f\"", "A semantic, recorded change"],
      ["baste branch cyberbotanist night-shift", "Explore an alternate fitting"],
      ["baste history cyberbotanist", "Every decision, with its reasons"],
    ],
  },
];

export const InstallSection = component$(() => {
  const locale = useLocale();
  return (
    <Section id="install">
      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "0.8fr 1.2fr" }, gap: { base: 10, lg: 16 } })}>
        <SectionHead
          kicker={text(locale.value, "05 — Thread the needle")}
          title={text(locale.value, "Start with the source. Fit offline before calling a model.")}
          lede={text(locale.value, "Generation supports --dry-run to draft prompts without calling a provider. The public Studio is a browser demo; use a local checkout for saved work and configured providers.")}
        >
          <div class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 4, w: "100%" })}>
            <CopyCommand command="git clone --branch main https://github.com/Diogenesoftoronto/baste.git" />
            <CopyCommand command="cd baste && npm ci && npm run build && npm link" />
          </div>
        </SectionHead>

        <div class={css({ display: "flex", flexDirection: "column", gap: 8 })}>
          {GROUPS.map((g) => (
            <div key={g.t}>
              <h3 class="label" style={{ color: "#2F55A4", marginBottom: "10px" }}>{text(locale.value, g.t)}</h3>
              <dl class={css({ display: "flex", flexDirection: "column" })}>
                {g.rows.map(([cmd, what]) => (
                  <div
                    key={cmd}
                    class={css({
                      display: "grid",
                      gridTemplateColumns: { base: "minmax(0, 1fr)", md: "minmax(0, 1.25fr) minmax(0, 1fr)" },
                      gap: { base: 1, md: 6 },
                      py: 3,
                      borderBottom: "1px solid token(colors.rule)",
                    })}
                  >
                    <dt class={css({ fontFamily: "mono", fontSize: "13px", color: "ink", overflowWrap: "anywhere" })}>
                      <span aria-hidden="true" style={{ color: "#A9311E" }}>$ </span>
                      {cmd}
                    </dt>
                    <dd class={css({ fontSize: "14px", color: "ink-muted" })}>{text(locale.value, what)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
});
