import { component$ } from "@builder.io/qwik";
import { useDocumentHead, useLocation } from "@builder.io/qwik-city";

const DESCRIPTION =
  "Baste turns a persona's films, music, spaces and obsessions into the design system, icons, images and motion that fit them.";

export const RouterHead = component$(() => {
  const head = useDocumentHead();
  const loc = useLocation();
  const title = head.title || "Baste — interfaces cut to fit one person";
  const og = new URL("/og-baste.png", loc.url).href;

  return (
    <>
      <title>{title}</title>
      <link rel="canonical" href={loc.url.href} />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

      <meta property="og:title" content={title} />
      <meta property="og:description" content={DESCRIPTION} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={loc.url.href} />
      <meta property="og:site_name" content="Baste" />
      <meta property="og:image" content={og} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content="Baste — one interface fitted to three personas, pinned to dyed cloth" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={DESCRIPTION} />
      <meta name="twitter:image" content={og} />
      <meta name="theme-color" content="#F1ECE2" />
      <link rel="apple-touch-icon" href="/icons/icon-192.svg" />

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
