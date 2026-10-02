import { useLocale } from '~/i18n/provider';
import { text } from '~/i18n/runtime';
import { $, component$, useComputed$, useContext, useStore, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { StudioCtx, errMsg, refreshPersonas, selectPersona, toast } from "../context";
import { btn, fieldLabel, hint, input, kicker, panel, panelTitle, splitList, textarea } from "../ui";
import { AESTHETIC_AXES } from "~/lib/fitting";
import type { AestheticProfile, Persona } from "~/lib/api-types";
import { play } from "~/lib/juice";

const LIST_FIELDS = [
  { key: "subcultures", label: "Subcultures", ph: "solarpunk, mycology, permaculture", group: "Culture" },
  { key: "values", label: "Values", ph: "interconnectedness, growth", group: "Culture" },
  { key: "films", label: "Films", ph: "Annihilation, Nausicaä", group: "Influences" },
  { key: "anime", label: "Anime & shows", ph: "Mushishi, Princess Mononoke", group: "Influences" },
  { key: "musicGenres", label: "Music genres", ph: "ambient, field recordings", group: "Influences" },
  { key: "musicArtists", label: "Artists they play", ph: "Biosphere, Mary Lattimore", group: "Influences" },
  { key: "visualArtists", label: "Visual artists", ph: "Ernst Haeckel, Rachel Ruysch", group: "Influences" },
  { key: "spaces", label: "Spaces", ph: "greenhouses, herbariums", group: "Habitat" },
  { key: "tools", label: "Tools", ph: "Raspberry Pi, Arduino", group: "Habitat" },
  { key: "obsessions", label: "Obsessions", ph: "mycelial network topology", group: "Habitat" },
  { key: "interfaceValues", label: "Values in software", ph: "discoverability, organic feedback", group: "Behaviour" },
  { key: "petPeeves", label: "Can't stand", ph: "sterile white dashboards", group: "Behaviour" },
] as const;

type ListKey = (typeof LIST_FIELDS)[number]["key"];

interface FormState {
  id: string;
  name: string;
  summary: string;
  region: string;
  lists: Record<ListKey, string>;
  aesthetic: Record<string, string>;
  keywords: string;
  mood: string;
  busy: boolean;
}

const slug = (v: string) => v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** New persona, edit a custom one, or tailor a copy of a base persona. */
export const PersonaForm = component$(() => {
  const s = useContext(StudioCtx);
  const locale = useLocale();
  const editing = s.view === "edit";
  const source = s.personas.find((p) => p.id === s.selectedId);
  const tailoring = s.view === "tailor" && !!source;

  const f = useStore<FormState>({
    id: "",
    name: "",
    summary: "",
    region: "",
    lists: Object.fromEntries(LIST_FIELDS.map((l) => [l.key, ""])) as Record<ListKey, string>,
    aesthetic: Object.fromEntries(AESTHETIC_AXES.map((a) => [a.key, a.options[0]])),
    keywords: "",
    mood: "",
    busy: false,
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    const p = editing || tailoring ? source : undefined;
    if (!p) {
      Object.assign(f.aesthetic, { colorTemperature: "warm", density: "rich", edgeStyle: "organic", motionStyle: "smooth", typographyStyle: "expressive", textureStyle: "textured", iconStyle: "line", layoutStyle: "editorial" });
      return;
    }
    f.id = editing ? p.id : `${p.id}-tailored`;
    f.name = editing ? p.name : `${p.name} (tailored)`;
    f.summary = p.summary;
    f.region = p.culture?.region ?? "";
    const j = (a?: string[]) => (a ?? []).join(", ");
    f.lists = {
      subcultures: j(p.culture?.subcultures), values: j(p.culture?.values),
      films: j(p.influences?.films), anime: j([...(p.influences?.anime ?? []), ...(p.influences?.shows ?? [])]),
      musicGenres: j(p.influences?.music?.genres), musicArtists: j(p.influences?.music?.artists),
      visualArtists: j(p.influences?.visualArtists), spaces: j(p.influences?.spaces), tools: j(p.influences?.tools),
      obsessions: j(p.influences?.obsessions), interfaceValues: j(p.behaviors?.interfaceValues), petPeeves: j(p.behaviors?.petPeeves),
    };
    for (const a of AESTHETIC_AXES) f.aesthetic[a.key] = String(p.aesthetic[a.key as keyof AestheticProfile]);
    f.keywords = j(p.aesthetic.visualKeywords);
    f.mood = j(p.aesthetic.moodKeywords);
  });

  const completeness = useComputed$(() => {
    const filled = LIST_FIELDS.filter((l) => f.lists[l.key].trim()).length + (f.summary.trim() ? 1 : 0) + (f.keywords.trim() ? 1 : 0);
    return Math.round((filled / (LIST_FIELDS.length + 2)) * 100);
  });

  const submit = $(async () => {
    if (!s.client) return;
    const id = slug(f.id || f.name);
    if (!id || !f.name.trim()) {
      play("error");
      toast(s, text(locale.value, "A persona needs a name"), "error");
      return;
    }
    const L = (k: ListKey) => splitList(f.lists[k]);
    const base = editing ? source : undefined;
    const persona: Persona = {
      ...(base as Persona | undefined),
      id,
      name: f.name.trim(),
      summary: f.summary.trim(),
      culture: { ...(base?.culture ?? {}), region: f.region.trim() || undefined, subcultures: L("subcultures"), values: L("values") },
      influences: {
        ...(base?.influences ?? { shows: [], games: [], fashion: [] }),
        films: L("films"), anime: L("anime"), shows: base?.influences?.shows ?? [],
        music: { genres: L("musicGenres"), artists: L("musicArtists") },
        games: base?.influences?.games ?? [], visualArtists: L("visualArtists"), fashion: base?.influences?.fashion ?? [],
        spaces: L("spaces"), tools: L("tools"), obsessions: L("obsessions"),
      },
      behaviors: {
        ...(base?.behaviors ?? { discovery: [], platforms: [], expression: [] }),
        discovery: base?.behaviors?.discovery ?? [], platforms: base?.behaviors?.platforms ?? [], expression: base?.behaviors?.expression ?? [],
        interfaceValues: L("interfaceValues"), petPeeves: L("petPeeves"),
      },
      aesthetic: {
        ...(f.aesthetic as unknown as AestheticProfile),
        visualKeywords: splitList(f.keywords),
        moodKeywords: splitList(f.mood),
      },
    } as Persona;

    f.busy = true;
    try {
      // Qwik context values may be proxies. Match the JSON wire payload used by
      // the live API before the in-memory client structured-clones this data.
      const payload = JSON.parse(JSON.stringify(persona)) as Persona;
      if (editing) await s.client.updatePersona(id, payload);
      else await s.client.createPersona(payload);
      play("fanfare");
      toast(s, editing ? text(locale.value, "{name} re-fitted", { name: persona.name }) : text(locale.value, "{name} added to the wardrobe", { name: persona.name }));
      await refreshPersonas(s);
      selectPersona(s, id, "fitting");
    } catch (err) {
      play("error");
      toast(s, errMsg(err), "error");
    } finally {
      f.busy = false;
    }
  });

  const groups = ["Culture", "Influences", "Habitat", "Behaviour"] as const;

  return (
    <form
      preventdefault:submit
      onSubmit$={submit}
      class={css({ display: "flex", flexDirection: "column", gap: 6, maxW: "1100px" })}
      aria-labelledby="pf-title"
    >
      <header class={css({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 4, flexWrap: "wrap" })}>
        <div>
          <span class={kicker}>{editing ? text(locale.value, "Re-measure") : tailoring ? text(locale.value, "Tailor a copy") : text(locale.value, "New measurement sheet")}</span>
          <h1 id="pf-title" class="display" style={{ fontSize: "clamp(32px, 4vw, 48px)" }}>
            {editing ? text(locale.value, "Edit {name}", { name: source?.name ?? "" }) : tailoring ? text(locale.value, "Tailor {name}", { name: source?.name ?? "" }) : text(locale.value, "Measure a new persona")}
          </h1>
          <p class={css({ color: "ink-soft", maxW: "62ch", mt: 2 })}>{text(locale.value, "Be specific. “Wong Kar-wai's Chungking Express” is a measurement; “likes movies” isn't. Lists are comma-separated.")}</p>
        </div>
        <div class={css({ minW: "180px" })} aria-label={text(locale.value, "Sheet {percent}% complete", { percent: completeness.value })}>
          <span class={css({ fontFamily: "mono", fontSize: "11.5px", color: "ink-muted" })}>{text(locale.value, "Sheet {percent}% measured", { percent: completeness.value })}</span>
          <div class={css({ h: "10px", mt: 1, rounded: "xs", bg: "tape", position: "relative", overflow: "hidden" })} style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(28,27,25,0.55) 0 1px, transparent 1px 6px)", backgroundSize: "auto 4px", backgroundRepeat: "repeat-x" }}>
            <span class={css({ position: "absolute", top: 0, bottom: 0, w: "2px", bg: "thread", transition: "left 0.5s token(easings.thread)" })} style={{ left: `${completeness.value}%` }} />
          </div>
        </div>
      </header>

      <section class={panel} aria-labelledby="pf-identity">
        <h2 id="pf-identity" class={panelTitle}>{text(locale.value, "Who they are")}</h2>
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr 1fr" }, gap: 4, mt: 4 })}>
          <div>
            <label class={fieldLabel} for="pf-name">{text(locale.value, "Name")}</label>
            <input id="pf-name" class={input} required placeholder={text(locale.value, "The Tide-Pool Archivist")} value={f.name} onInput$={(_, el) => { f.name = el.value; if (!editing) f.id = slug(el.value); }} />
          </div>
          <div>
            <label class={fieldLabel} for="pf-id">{text(locale.value, "Slug")}</label>
            <input id="pf-id" class={input} value={f.id} disabled={editing} onInput$={(_, el) => (f.id = slug(el.value))} />
            <p class={hint}>{text(locale.value, "File:")} personas/{f.id || "…"}.json</p>
          </div>
          <div>
            <label class={fieldLabel} for="pf-region">{text(locale.value, "Region")}</label>
            <input id="pf-region" class={input} placeholder={text(locale.value, "Pacific Northwest")} value={f.region} onInput$={(_, el) => (f.region = el.value)} />
          </div>
        </div>
        <label class={fieldLabel} for="pf-summary" style={{ marginTop: "16px" }}>{text(locale.value, "In a sentence or two")}</label>
        <textarea id="pf-summary" class={textarea} rows={3} placeholder={text(locale.value, "By day… by night… They believe…")} value={f.summary} onInput$={(_, el) => (f.summary = el.value)} />
      </section>

      {groups.map((g) => (
        <section key={g} class={panel} aria-labelledby={`pf-${g}`}>
          <h2 id={`pf-${g}`} class={panelTitle}>{text(locale.value, g)}</h2>
          <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4, mt: 4 })}>
            {LIST_FIELDS.filter((l) => l.group === g).map((l) => (
              <div key={l.key}>
                <label class={fieldLabel} for={`pf-${l.key}`}>{text(locale.value, l.label)}</label>
                <input id={`pf-${l.key}`} class={input} placeholder={text(locale.value, l.ph)} value={f.lists[l.key]} onInput$={(_, el) => (f.lists[l.key] = el.value)} />
              </div>
            ))}
          </div>
        </section>
      ))}

      <section class={panel} aria-labelledby="pf-cut">
        <h2 id="pf-cut" class={panelTitle}>{text(locale.value, "The cut")}</h2>
        <p class={hint}>{text(locale.value, "How their world should feel in an interface. These drive the generated tokens directly.")}</p>
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 5, mt: 4 })}>
          {AESTHETIC_AXES.map((ax) => (
            <fieldset key={ax.key} class={css({ border: 0, p: 0 })}>
              <legend class={fieldLabel}>{text(locale.value, ax.label)}</legend>
              <div class={css({ display: "flex", flexWrap: "wrap", gap: "6px" })}>
                {ax.options.map((o) => (
                  <label
                    key={o}
                    class={css({ display: "inline-flex", alignItems: "center", h: "30px", px: 3, rounded: "full", border: "1px solid token(colors.rule-strong)", fontSize: "13px", cursor: "pointer", bg: "card", transition: "all 0.15s", "&:has(input:checked)": { bg: "ink", color: "paper", borderColor: "ink" }, "&:has(input:focus-visible)": { outline: "2px solid token(colors.chalk)", outlineOffset: "2px" } })}
                  >
                    <input type="radio" name={ax.key} value={o} checked={f.aesthetic[ax.key] === o} onChange$={() => (f.aesthetic[ax.key] = o)} class={css({ position: "absolute", opacity: 0, w: 0, h: 0 })} />
                    {text(locale.value, o)}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div class={css({ display: "grid", gridTemplateColumns: { base: "minmax(0, 1fr)", md: "1fr 1fr" }, gap: 4, mt: 5 })}>
          <div>
            <label class={fieldLabel} for="pf-kw">{text(locale.value, "Visual keywords")}</label>
            <input id="pf-kw" class={input} placeholder={text(locale.value, "bioluminescent, herbariums, natural dyes")} value={f.keywords} onInput$={(_, el) => (f.keywords = el.value)} />
            <p class={hint}>{text(locale.value, "The strongest signal for palette and type.")}</p>
          </div>
          <div>
            <label class={fieldLabel} for="pf-mood">{text(locale.value, "Mood keywords")}</label>
            <input id="pf-mood" class={input} placeholder={text(locale.value, "growth, hidden complexity")} value={f.mood} onInput$={(_, el) => (f.mood = el.value)} />
          </div>
        </div>
      </section>

      <div class={css({ position: "sticky", bottom: 4, display: "flex", gap: 3, justifyContent: "flex-end", p: 3, rounded: "lg", bg: "rgba(251,249,244,0.92)", backdropFilter: "blur(8px)", border: "1px solid token(colors.rule)", boxShadow: "lift" })}>
        <button type="button" class={btn("ghost")} onClick$={() => (s.view = "persona")}>{text(locale.value, "Cancel")}</button>
        <button type="submit" class={btn("primary")} data-juice="snip" disabled={f.busy}>
          {f.busy ? text(locale.value, "Stitching…") : editing ? text(locale.value, "Save measurements") : text(locale.value, "Add to wardrobe")}
        </button>
      </div>
    </form>
  );
});
