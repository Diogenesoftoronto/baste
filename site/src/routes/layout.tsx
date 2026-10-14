import { component$, Slot } from "@builder.io/qwik";
import { routeLoader$ } from "@builder.io/qwik-city";
import { LocaleProvider } from "~/i18n/provider";
import { resolveLocale, LANGUAGE_COOKIE } from "~/i18n/runtime";
import type { RequestHandler } from "@builder.io/qwik-city";
import { FabricBackdrop } from "~/components/fx/fabric";
import { ThreadCursor } from "~/components/fx/thread-cursor";
import { Reveal } from "~/components/fx/reveal";
import { Juice } from "~/components/fx/juice";

export const useInitialLocale = routeLoader$(({ url, cookie, request }) => resolveLocale(url.searchParams.get('lang'), cookie.get(LANGUAGE_COOKIE)?.value, request.headers.get('accept-language') ?? ''));

export const onGet: RequestHandler = async ({ cacheControl, headers, locale, url, cookie, request }) => {
  locale(resolveLocale(url.searchParams.get("lang"), cookie.get(LANGUAGE_COOKIE)?.value, request.headers.get("accept-language") ?? ""));
  headers.set("Vary", "Accept-Language, Cookie");
  cacheControl({
    staleWhileRevalidate: 0,
    maxAge: 0,
  });
};

export default component$(() => {
  const locale = useInitialLocale();
  return (
    <LocaleProvider initialLocale={locale.value}>
      <FabricBackdrop />
      <Slot />
      <ThreadCursor />
      <Reveal />
      <Juice />
    </LocaleProvider>
  );
});
