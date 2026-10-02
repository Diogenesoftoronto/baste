import { component$, useSignal, useVisibleTask$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

/**
 * The needle cursor's thread: a short verlet rope tied to the needle's eye.
 * It trails, swings and settles under gravity, drawn as basting stitches.
 * Fine pointers only; skipped entirely under reduced motion.
 */
export const ThreadCursor = component$(() => {
  const canvas = useSignal<HTMLCanvasElement>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const fine = window.matchMedia("(pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const root = document.documentElement;
    if (!fine) return;
    root.dataset.cursor = "needle";
    cleanup(() => delete root.dataset.cursor);
    if (reduced || !canvas.value) return;

    const cv = canvas.value;
    const ctx = cv.getContext("2d")!;
    const N = 22;
    const SEG = 7;
    const EYE = { x: 24.5, y: -24 }; // needle eye relative to the hotspot
    const pts = Array.from({ length: N }, () => ({ x: -100, y: -100, px: -100, py: -100 }));
    let anchor = { x: -100, y: -100 };
    let active = false;
    let idle = 0;
    let dpr = 1;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(window.innerWidth * dpr);
      cv.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      anchor = { x: e.clientX + EYE.x, y: e.clientY + EYE.y };
      if (!active) {
        for (const p of pts) Object.assign(p, { x: anchor.x, y: anchor.y, px: anchor.x, py: anchor.y });
        active = true;
      }
      idle = 0;
      if (!raf) raf = requestAnimationFrame(step);
    };
    const onLeave = () => {
      active = false;
      ctx.clearRect(0, 0, cv.width, cv.height);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);

    let raf = 0;
    const step = () => {
      raf = 0;
      if (!active) return;
      // verlet integrate
      for (let i = 1; i < N; i++) {
        const p = pts[i];
        const vx = (p.x - p.px) * 0.94;
        const vy = (p.y - p.py) * 0.94;
        p.px = p.x;
        p.py = p.y;
        p.x += vx;
        p.y += vy + 0.42;
      }
      pts[0].x = anchor.x;
      pts[0].y = anchor.y;
      // constraints
      for (let k = 0; k < 6; k++) {
        for (let i = 0; i < N - 1; i++) {
          const a = pts[i], b = pts[i + 1];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 0.001;
          const diff = (d - SEG) / d;
          if (i === 0) {
            b.x -= dx * diff;
            b.y -= dy * diff;
          } else {
            a.x += dx * diff * 0.5;
            a.y += dy * diff * 0.5;
            b.x -= dx * diff * 0.5;
            b.y -= dy * diff * 0.5;
          }
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      // soft cast shadow, then the thread itself as stitches
      ctx.beginPath();
      ctx.moveTo(pts[0].x + 2, pts[0].y + 3);
      for (let i = 1; i < N; i++) ctx.lineTo(pts[i].x + 2, pts[i].y + 3);
      ctx.strokeStyle = "rgba(28,27,25,0.12)";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < N - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.strokeStyle = "#D2402A";
      ctx.lineWidth = 1.8;
      ctx.stroke();
      // a little knot at the end
      const end = pts[N - 1];
      ctx.beginPath();
      ctx.arc(end.x, end.y, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = "#A9311E";
      ctx.fill();

      // stop simulating once the thread hangs still
      const tail = pts[N - 1];
      idle = Math.abs(tail.x - tail.px) + Math.abs(tail.y - tail.py) < 0.02 ? idle + 1 : 0;
      if (idle < 30) raf = requestAnimationFrame(step);
    };

    cleanup(() => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    });
  });

  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      class={css({ position: "fixed", inset: 0, w: "100vw", h: "100vh", pointerEvents: "none", zIndex: 9999 })}
    />
  );
});
