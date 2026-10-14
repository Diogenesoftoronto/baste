/** Art-directed UI replacements, used by the fitting room and the recorded-run replay.
 * The original generated assets and judge scores stay in fittings.json. */
export const fittingIcons: Record<string, {
  icon: { src: string; label: string };
  "icon-collection": { src: string; label: string };
}> = {
  cyberbotanist: {
    icon: { src: "/assets/fittings/cyberbotanist-mycelium.svg", label: "Mycelial network" },
    "icon-collection": { src: "/assets/fittings/cyberbotanist-herbarium.svg", label: "Herbarium collection" },
  },
};
