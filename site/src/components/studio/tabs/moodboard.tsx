import { useLocale } from '~/i18n/provider';
import { text } from '~/i18n/runtime';
import { $, component$, useContext, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, toast } from "../context";
import { btn, btnSm, emptyBox, fieldLabel, hint, input, kicker, panel, panelTitle, splitList, textarea } from "../ui";
import type { Moodboard, SplitResult } from "~/lib/api-types";

function tilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.6;
}

export const MoodboardTab = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const board = useSignal<Moodboard | null>(null);
  const src = useSignal("");
  const tags = useSignal("");
  const notesDirty = useSignal(false);
  const split = useSignal<SplitResult | null>(null);
  const splitSrc = useSignal("");
  const cols = useSignal(4);
  const rows = useSignal(4);

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ track }) => {
    const id = track(() => s.selectedId);
    if (!s.client) return;
    try {
      board.value = await s.client.getMoodboard(id);
    } catch (err) {
      toast(s, errMsg(err), "error");
    }
  });

  const save = $(async (next: Moodboard, msg?: string) => {
    board.value = next;
    try {
      await s.client!.putMoodboard(s.selectedId, next);
      if (msg) toast(s, msg);
    } catch (err) {
      toast(s, errMsg(err), "error");
    }
  });

  const add = $(async () => {
    const url = src.value.trim();
    if (!url) return;
    try {
      await s.client!.addReference(s.selectedId, { src: url, tags: splitList(tags.value) });
      board.value = await s.client!.getMoodboard(s.selectedId);
      src.value = "";
      tags.value = "";
      toast(s, text(locale.value, "Pinned to the board"));
    } catch (err) {
      toast(s, errMsg(err), "error");
    }
  });

  const img = (u: string) => (s.status === "live" && /^https?:/.test(u) ? s.client!.proxyUrl(u) : u);
  const refs = board.value ? [...board.value.references].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.addedAt - a.addedAt) : [];

  return (
    <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", xl: "minmax(0, 1.4fr) minmax(300px, 0.6fr)" }, gap: 6, alignItems: "start" })}>
      <section aria-labelledby="mb-title" class={css({ display: "flex", flexDirection: "column", gap: 4, minW: 0 })}>
        <div>
          <span class={kicker}>{text(locale.value, "Pinboard")}</span>
          <h2 id="mb-title" class={panelTitle}>{text(locale.value, "References")}</h2>
        </div>
        {/* cork-ish board: muslin with a pin on every card */}
        {refs.length === 0 ? (
          <div class={emptyBox}>
            <p class={css({ fontWeight: 600, color: "ink" })}>{text(locale.value, "Nothing pinned yet.")}</p>
            <p class={css({ fontSize: "14px" })}>{text(locale.value, "Paste an image URL — a film still, a shop sign, a texture. Pinned references steer generation.")}</p>
          </div>
        ) : (
          <ul class={css({ listStyle: "none", columns: { base: 2, md: 3 }, columnGap: 5, p: 5, rounded: "lg", bg: "muslin", boxShadow: "inset 0 2px 8px rgba(60,45,20,0.15)" })}>
            {refs.map((r) => (
              <li
                key={r.id}
                class={css({ breakInside: "avoid", mb: 5, position: "relative", bg: "card", p: 2, pb: 3, boxShadow: "sheet", transition: "transform 0.35s token(easings.thread)", _hover: { transform: "rotate(0deg) scale(1.02) !important", zIndex: 2 } })}
                style={{ transform: `rotate(${tilt(r.id)}deg)` }}
              >
                {r.pinned && <span class="pin-head" style={{ left: "calc(50% - 7px)", top: "-6px" }} aria-hidden="true" />}
                <img src={img(r.src)} alt={r.tags.join(", ") || text(locale.value, "Reference")} loading="lazy" width={300} height={200} class={css({ display: "block", w: "100%", h: "auto", bg: "paper-deep", minH: "80px", objectFit: "cover" })} />
                <div class={css({ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 })}>
                  {r.tags.map((t) => (
                    <span key={t} class={css({ fontSize: "11px", fontFamily: "mono", color: "chalk" })}>#{t}</span>
                  ))}
                </div>
                <div class={css({ display: "flex", gap: 1, mt: 2 })}>
                  <button
                    class={btn("ghost", btnSm)}
                    data-juice="pin"
                    aria-pressed={r.pinned}
                    onClick$={() =>
                      save({ ...board.value!, references: board.value!.references.map((x) => (x.id === r.id ? { ...x, pinned: !x.pinned } : x)) }, r.pinned ? text(locale.value, "Unpinned") : text(locale.value, "Pinned"))
                    }
                  >
                    {r.pinned ? text(locale.value, "Unpin") : text(locale.value, "Pin")}
                  </button>
                  <button class={btn("ghost", btnSm)} onClick$={() => (splitSrc.value = r.src)}>{text(locale.value, "Split")}</button>
                  <button
                    class={btn("ghost", `${btnSm} ${css({ ml: "auto", color: "thread-ink" })}`)}
                    aria-label={text(locale.value, "Remove reference")}
                    onClick$={() => save({ ...board.value!, references: board.value!.references.filter((x) => x.id !== r.id) }, text(locale.value, "Removed"))}
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside class={css({ display: "flex", flexDirection: "column", gap: 6 })}>
        <section class={panel} aria-labelledby="mb-add">
          <h2 id="mb-add" class={panelTitle}>{text(locale.value, "Pin a reference")}</h2>
          <div class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 4 })}>
            <div>
              <label class={fieldLabel} for="mb-src">{text(locale.value, "Image URL")}</label>
              <input id="mb-src" class={input} placeholder="https://…/still.jpg" bind:value={src} onKeyDown$={(e) => e.key === "Enter" && add()} />
            </div>
            <div>
              <label class={fieldLabel} for="mb-tags">{text(locale.value, "Tags")}</label>
              <input id="mb-tags" class={input} placeholder={text(locale.value, "neon, wet asphalt, signage")} bind:value={tags} />
            </div>
            <button class={btn("primary")} data-juice="pin" disabled={!src.value.trim()} onClick$={add}>{text(locale.value, "Pin it")}</button>
          </div>
        </section>

        {board.value && (
          <section class={panel} aria-labelledby="mb-notes">
            <h2 id="mb-notes" class={panelTitle}>{text(locale.value, "Notes & vibe")}</h2>
            <label class={fieldLabel} for="mb-vibe" style={{ marginTop: "16px" }}>{text(locale.value, "Vibe words")}</label>
            <input
              id="mb-vibe"
              class={input}
              value={board.value.vibe.join(", ")}
              onChange$={(_, el) => save({ ...board.value!, vibe: splitList(el.value) }, text(locale.value, "Vibe saved"))}
            />
            <label class={fieldLabel} for="mb-text" style={{ marginTop: "12px" }}>{text(locale.value, "Notes")}</label>
            <textarea
              id="mb-text"
              class={textarea}
              rows={5}
              value={board.value.notes}
              onInput$={() => (notesDirty.value = true)}
              onBlur$={(_, el) => {
                if (notesDirty.value) save({ ...board.value!, notes: el.value }, text(locale.value, "Notes saved"));
                notesDirty.value = false;
              }}
            />
            <p class={hint}>{text(locale.value, "Saved when you leave the field.")}</p>
          </section>
        )}

        <section class={panel} aria-labelledby="mb-split">
          <h2 id="mb-split" class={panelTitle}>{text(locale.value, "Split a sheet")}</h2>
          <p class={hint}>{text(locale.value, "Cut a contact sheet or icon grid into cells, ready for QuiverAI remakes.")}</p>
          <div class={css({ display: "flex", flexDirection: "column", gap: 3, mt: 3 })}>
            <input class={input} aria-label={text(locale.value, "Sheet image URL")} placeholder={text(locale.value, "Image URL or local path")} bind:value={splitSrc} />
            <div class={css({ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 })}>
              <label class={css({ fontSize: "13px" })}>{text(locale.value, "Columns")}<input type="range" min={1} max={8} value={cols.value} onInput$={(_, el) => (cols.value = Number(el.value))} class={css({ w: "100%", accentColor: "#D2402A" })} />
                <span class={css({ fontFamily: "mono", fontSize: "12px" })}>{cols.value}</span>
              </label>
              <label class={css({ fontSize: "13px" })}>{text(locale.value, "Rows")}<input type="range" min={1} max={8} value={rows.value} onInput$={(_, el) => (rows.value = Number(el.value))} class={css({ w: "100%", accentColor: "#D2402A" })} />
                <span class={css({ fontFamily: "mono", fontSize: "12px" })}>{rows.value}</span>
              </label>
            </div>
            <button
              class={btn("secondary")}
              data-juice="snip"
              disabled={!splitSrc.value.trim()}
              onClick$={async () => {
                try {
                  split.value = await s.client!.split({ src: splitSrc.value.trim(), cols: cols.value, rows: rows.value, strategy: "grid" });
                  toast(s, text(locale.value, "{count} cells cut", { count: split.value.cells.length }));
                } catch (err) {
                  toast(s, errMsg(err), "error");
                }
              }}
            >{text(locale.value, "Cut into {count}", { count: cols.value * rows.value })}
            </button>
            {split.value && (
              <div class={css({ display: "grid", gap: "3px" })} style={{ gridTemplateColumns: `repeat(${cols.value}, 1fr)` }}>
                {split.value.cells.map((c, i) => {
                  const col = i % cols.value;
                  const row = Math.floor(i / cols.value);
                  const px = cols.value > 1 ? (col / (cols.value - 1)) * 100 : 0;
                  const py = rows.value > 1 ? (row / (rows.value - 1)) * 100 : 0;
                  return (
                    <div key={c.id} title={c.label} class={css({ aspectRatio: "1", bg: "paper-deep", rounded: "xs", backgroundRepeat: "no-repeat" })} style={{ backgroundImage: `url(${img(split.value!.src)})`, backgroundSize: `${cols.value * 100}% ${rows.value * 100}%`, backgroundPosition: `${px}% ${py}%` }} />
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
});
