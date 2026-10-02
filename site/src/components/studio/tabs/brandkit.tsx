import { useLocale } from '~/i18n/provider';
import { text } from '~/i18n/runtime';
import { component$, useContext, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, openView, toast } from "../context";
import { btn, emptyBox, kicker, panel, panelTitle } from "../ui";
import type { BrandKit } from "~/lib/api-types";
import { onColor } from "~/lib/fitting";

export const BrandKitTab = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const kit = useSignal<BrandKit | null>(null);
  const loading = useSignal(true);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const id = track(() => s.selectedId);
    if (!s.client) return;
    loading.value = true;
    try {
      kit.value = await s.client.getBrandKit(id);
    } catch (err) {
      kit.value = null;
      toast(s, errMsg(err), "error");
    } finally {
      loading.value = false;
    }
  });

  if (loading.value) return <div aria-busy="true" class={css({ h: "300px", rounded: "lg", bg: "paper-deep", opacity: 0.5 })} />;

  if (!kit.value) {
    return (
      <div class={emptyBox}>
        <span class={kicker}>{text(locale.value, "No brand kit")}</span>
        <h2 class="display" style={{ fontSize: "30px" }}>{text(locale.value, "This persona wasn't cut from a website.")}</h2>
        <p class={css({ maxW: "56ch" })}>{text(locale.value, "Brand kits come from decomposing a live site: its palette with roles, fonts, logo, OG image and imagery. Decompose a site to draft a new persona with its kit attached.")}</p>
        <button class={btn("primary")} onClick$={() => openView(s, "decompose")}>{text(locale.value, "Decompose a site")}</button>
      </div>
    );
  }

  const k = kit.value;
  const proxy = (u: string) => (s.client ? s.client.proxyUrl(u) : u);
  const roles = Object.entries(k.paletteRoles).filter(([, v]) => v) as Array<[string, string]>;

  return (
    <div class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
      <section class={panel} aria-labelledby="bk-title">
        <div class={css({ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" })}>
          {k.logo && <img src={proxy(k.logo)} alt={`${k.title} logo`} width={96} height={48} class={css({ maxH: "56px", w: "auto", maxW: "140px", objectFit: "contain", p: 2, bg: "paper", rounded: "base" })} />}
          <div class={css({ flex: 1, minW: "240px" })}>
            <span class={kicker}>{text(locale.value, "Cut from")}</span>
            <h2 id="bk-title" class={panelTitle}>{k.title || k.sourceUrl}</h2>
            <a href={k.sourceUrl} target="_blank" rel="noopener" class={css({ fontFamily: "mono", fontSize: "12.5px", color: "chalk" })}>{k.sourceUrl}</a>
            {k.description && <p class={css({ fontSize: "14px", color: "ink-soft", mt: 2, maxW: "70ch" })}>{k.description}</p>}
          </div>
          <span class={css({ fontFamily: "mono", fontSize: "11.5px", color: "ink-muted" })}>{new Date(k.fetchedAt).toLocaleString(locale.value)}</span>
        </div>
      </section>

      <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", lg: "1fr 1fr" }, gap: 6 })}>
        <section class={panel} aria-labelledby="bk-pal">
          <h2 id="bk-pal" class={panelTitle}>{text(locale.value, "Palette roles")}</h2>
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: 3, mt: 4 })}>
            {roles.map(([role, hex]) => (
              <li key={role} class={css({ h: "72px", rounded: "base", p: 2, display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid rgba(28,27,25,0.12)" })} style={{ background: hex, color: onColor(hex) }}>
                <span class={css({ fontSize: "12px", fontWeight: 600 })}>{role}</span>
                <span class={css({ fontFamily: "mono", fontSize: "11px" })}>{hex}</span>
              </li>
            ))}
          </ul>
          <div class={css({ display: "flex", mt: 4, h: "18px", rounded: "xs", overflow: "hidden" })} aria-label={text(locale.value, "Full extracted palette")} role="img">
            {k.palette.map((h, i) => (
              <span key={i} style={{ flex: 1, background: h }} title={h} />
            ))}
          </div>
        </section>

        <section class={panel} aria-labelledby="bk-type">
          <h2 id="bk-type" class={panelTitle}>{text(locale.value, "Type & signals")}</h2>
          <ul class={css({ listStyle: "none", mt: 4, display: "flex", flexDirection: "column", gap: 2 })}>
            {k.fonts.map((f) => (
              <li key={f} class={css({ display: "flex", justifyContent: "space-between", py: 2, borderBottom: "1px solid token(colors.rule)" })}>
                <span style={{ fontFamily: `'${f}', serif`, fontSize: "18px" }}>{f}</span>
                <span class={css({ fontFamily: "mono", fontSize: "11px", color: "ink-muted" })}>{k.fontFaces.some((ff) => ff.family === f && ff.src) ? "@font-face" : "system"}</span>
              </li>
            ))}
          </ul>
          <dl class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, mt: 4, fontSize: "13px" })}>
            {([
              [text(locale.value, "Body face"), k.signals.bodyFontCategory],
              [text(locale.value, "Avg radius"), `${Math.round(k.signals.borderRadiusAvg)}px`],
              [text(locale.value, "Grid layout"), k.signals.hasGrid ? "yes" : "no"],
              [text(locale.value, "Images"), String(k.signals.imageCount)],
            ] as const).map(([a, b]) => (
              <div key={text(locale.value, a)}>
                <dt class={css({ color: "ink-muted", fontSize: "12px" })}>{text(locale.value, a)}</dt>
                <dd class={css({ fontFamily: "mono" })}>{b}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      {(k.ogImage || k.images.length > 0) && (
        <section class={panel} aria-labelledby="bk-img">
          <h2 id="bk-img" class={panelTitle}>{text(locale.value, "Imagery")}</h2>
          <ul class={css({ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 3, mt: 4 })}>
            {[...(k.ogImage ? [{ url: k.ogImage, alt: text(locale.value, "Open Graph image") }] : []), ...k.images.slice(0, 15)].map((im) => (
              <li key={im.url}>
                <img src={proxy(im.url)} alt={im.alt || ""} loading="lazy" width={150} height={100} class={css({ w: "100%", h: "100px", objectFit: "cover", rounded: "sm", bg: "paper-deep" })} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
});
