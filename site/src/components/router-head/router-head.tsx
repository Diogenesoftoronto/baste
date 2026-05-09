import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";

export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();

  return (
    <>
      <title>{head.title}</title>
      <link rel="canonical" href={loc.url.href} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

      {/* Open Graph / social preview */}
      <meta property="og:title" content={head.title || "Baste — Co-create great designs"} />
      <meta property="og:description" content="AI co-creation for brandkits, icons, logos, SVGs, images, and video assets. Transform generic interfaces into culturally rich experiences." />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={loc.url.href} />
      <meta property="og:image" content={new URL("/og-baste.png", loc.url).href} />
      <meta property="og:image:width" content="1792" />
      <meta property="og:image:height" content="1024" />
      <meta property="og:image:alt" content="Baste — neon graffiti drip brand kit preview" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={head.title || "Baste — Co-create great designs"} />
      <meta name="twitter:description" content="AI co-creation for brandkits, icons, logos, SVGs, images, and video assets." />
      <meta name="twitter:image" content={new URL("/og-baste.png", loc.url).href} />
      <meta name="theme-color" content="#C6FF00" />

      {head.meta.map((m) => (
        <meta key={m.key} {...m} />
      ))}

      {head.links.map((l) => (
        <link key={l.key} {...l} />
      ))}

      {head.styles.map((s) => (
        <style key={s.key} {...s.props} dangerouslySetInnerHTML={s.style} />
      ))}
    </>
  );
});
