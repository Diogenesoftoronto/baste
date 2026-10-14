import { component$, Slot } from "@builder.io/qwik";
import type { RequestHandler } from "@builder.io/qwik-city";
import { FabricBackdrop } from "~/components/fx/fabric";
import { ThreadCursor } from "~/components/fx/thread-cursor";
import { Reveal } from "~/components/fx/reveal";
import { Juice } from "~/components/fx/juice";

export const onGet: RequestHandler = async ({ cacheControl }) => {
  cacheControl({
    staleWhileRevalidate: 60 * 60 * 24 * 7,
    maxAge: 5,
  });
};

export default component$(() => {
  return (
    <>
      <FabricBackdrop />
      <Slot />
      <ThreadCursor />
      <Reveal />
      <Juice />
    </>
  );
});
