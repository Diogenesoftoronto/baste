/** Art-directed UI replacements. Keep the original generated assets and judge
 * scores in fittings.json for recorded-run playback and downloads. */
export const fittingIcons: Record<string, {
  icon: { src: string; label: string };
  "icon-collection": { src: string; label: string };
}> = {
  cyberbotanist: {
    icon: { src: "/assets/fittings/cyberbotanist-mycelium.svg", label: "Mycelial network" },
    "icon-collection": { src: "/assets/fittings/cyberbotanist-herbarium.svg", label: "Herbarium collection" },
  },
};
