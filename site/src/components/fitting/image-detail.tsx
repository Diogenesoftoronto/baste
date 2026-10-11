import { component$, useId, useSignal, useStyles$, useVisibleTask$ } from "@builder.io/qwik";
import styles from "./image-detail.css?inline";

/** A top-layer loupe: it escapes the fitting's transforms and clipped cards. */
export const ImageDetail = component$<{ src: string; label: string; width: number; height: number; class?: string }>((props) => {
  useStyles$(styles);
  const id = useId();
  const trigger = useSignal<HTMLButtonElement>();
  const panel = useSignal<HTMLDivElement>();

  // Native listeners keep hover, focus and dismissal synchronous after setup.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const button = trigger.value!;
    const popup = panel.value!;
    let timer: ReturnType<typeof setTimeout>;
    let pinned = false;
    const cancel = () => clearTimeout(timer);
    const close = () => {
      cancel();
      popup.hidePopover();
      button.setAttribute("aria-expanded", "false");
      pinned = false;
    };
    const position = () => {
      const r = button.getBoundingClientRect();
      const w = popup.offsetWidth;
      const h = popup.offsetHeight;
      const top = r.top > h + 28 ? r.top - h - 16 : r.bottom + 16;
      popup.style.left = `${Math.max(12, Math.min(innerWidth - w - 12, r.left + r.width / 2 - w / 2))}px`;
      popup.style.top = `${Math.max(24, Math.min(innerHeight - h - 12, top))}px`;
    };
    const show = () => {
      cancel();
      popup.showPopover();
      button.setAttribute("aria-expanded", "true");
      position();
    };
    const leave = () => {
      cancel();
      if (!pinned) timer = setTimeout(close, 220);
    };
    const hover = (event: PointerEvent) => { if (event.pointerType === "mouse") show(); };
    const click = () => { if (pinned) close(); else { show(); pinned = true; } };
    const blur = (event: FocusEvent) => {
      if (!popup.contains(event.relatedTarget as Node) && event.relatedTarget !== button) close();
    };
    const dismiss = (event: Event) => {
      if ((event.target as HTMLElement).closest("[data-detail-close]")) { close(); button.focus({ preventScroll: true }); close(); }
    };
    const toggle = () => { if (!popup.matches(":popover-open")) { pinned = false; button.setAttribute("aria-expanded", "false"); } };
    button.addEventListener("pointerenter", hover);
    button.addEventListener("pointerleave", leave);
    button.addEventListener("focus", show);
    button.addEventListener("focusout", blur);
    button.addEventListener("click", click);
    popup.addEventListener("pointerenter", cancel);
    popup.addEventListener("pointerleave", leave);
    popup.addEventListener("focusout", blur);
    popup.addEventListener("click", dismiss);
    popup.addEventListener("toggle", toggle);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    cleanup(() => {
      cancel();
      button.removeEventListener("pointerenter", hover);
      button.removeEventListener("pointerleave", leave);
      button.removeEventListener("focus", show);
      button.removeEventListener("focusout", blur);
      button.removeEventListener("click", click);
      popup.removeEventListener("pointerenter", cancel);
      popup.removeEventListener("pointerleave", leave);
      popup.removeEventListener("focusout", blur);
      popup.removeEventListener("click", dismiss);
      popup.removeEventListener("toggle", toggle);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    });
  });

  return <>
    <button ref={trigger} type="button" class={`image-detail-trigger ${props.class ?? ""}`} aria-label={`View ${props.label}`} aria-expanded="false" aria-controls={id}>
      <img src={props.src} alt="" width={props.width} height={props.height} loading="lazy" decoding="async" />
    </button>
    <div ref={panel} id={id} popover="auto" class="image-detail-panel" role="region" aria-label={props.label}>
      <span class="image-detail-blob" aria-hidden="true" />
      <img class="image-detail-full" src={props.src} alt={props.label} width={props.width} height={props.height} loading="lazy" />
      <div class="image-detail-caption"><span>{props.label}</span><button type="button" data-detail-close aria-label="Close image preview">×</button></div>
    </div>
  </>;
});
