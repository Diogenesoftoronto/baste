import { component$, useContext } from "@builder.io/qwik";
import { css } from "styled-system/css";
import { MaterialLab } from "~/components/materials/material-lab";
import { materialForPersona, materialReason, personaMaterialKey, personaSwatch } from "~/lib/materials";
import { StudioCtx } from "../context";
import { hint, kicker, panelTitle } from "../ui";

/**
 * The persona's own cloth. Starts from its palette and aesthetic profile;
 * every change saves to this browser and re-dyes the persona header above.
 */
export const MaterialTab = component$(() => {
  const s = useContext(StudioCtx);
  const persona = s.personas.find((p) => p.id === s.selectedId);
  const tokens = persona ? s.tokens[persona.id] : undefined;

  if (!persona || !tokens) return <div aria-busy="true" class={css({ h: "520px", rounded: "lg", bg: "paper-deep", opacity: 0.5 })} />;

  return (
    <section aria-labelledby="mat-title" class={css({ display: "flex", flexDirection: "column", gap: 4 })}>
      <div class={css({ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 3 })}>
        <div>
          <span class={kicker}>Material</span>
          <h2 id="mat-title" class={panelTitle}>{persona.name}'s cloth</h2>
          <p class={hint}>
            {materialReason(persona)} Dyed from its palette and seeded by its id, so it is always the same cloth until you change it. Changes save
            to this browser and re-dye the header.
          </p>
        </div>
      </div>
      <MaterialLab
        key={persona.id}
        initial={materialForPersona(persona, tokens)}
        initialName={`${persona.name}, fitted`}
        initialSwatch={personaSwatch(persona.id)}
        storageKey={personaMaterialKey(persona.id)}
        slug={persona.id}
        sampleTitle={persona.name}
        sampleLine={persona.summary}
      />
    </section>
  );
});
