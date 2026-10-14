import { component$, useStyles$ } from "@builder.io/qwik";
import fittings from "~/lib/fittings.json";
import { fittingIcons } from "~/lib/fitting-icons";
import { ImageDetail } from "./image-detail";
import styles from "./fitting-gallery.css?inline";

export const FittingGallery = component$<{ personaId: string; name: string }>(({ personaId, name }) => {
  useStyles$(styles);
  const recorded = fittings[personaId as keyof typeof fittings];
  if (!recorded) return null;
  const icons = fittingIcons[personaId] ?? {
    icon: { ...recorded.icon, label: name },
    "icon-collection": { ...recorded["icon-collection"], label: name },
  };
  return <div class="fitting-gallery" role="group" aria-label={name}>
    <div class="fitting-gallery-icons">
      {Object.values(icons).map((icon) => <ImageDetail key={icon.src} src={icon.src} label={icon.label} width={72} height={72} />)}
    </div>
    <ul class="fitting-gallery-studies">
      {[recorded.hero, ...recorded.archive].map((art, i) => <li key={art.src}>
        <ImageDetail src={art.src} label={`${name} · ${String(i + 1).padStart(2, "0")}`} width={720} height={405} />
      </li>)}
    </ul>
  </div>;
});
