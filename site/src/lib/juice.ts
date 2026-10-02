/**
 * Juice — the feedback layer on top of what each action must do.
 * (After Brad Woods, "Juice": redundant feedback on every input — motion,
 * sound and touch — weighted toward the actions people repeat most.)
 *
 * Everything is synthesized: no audio files. Sounds are atelier sounds:
 * a scissor snip, a pin pressed into a cushion, thread pulled taut, chalk.
 */

export type Sound = "tick" | "pin" | "snip" | "thread" | "chalk" | "error" | "fanfare";

const SOUND_KEY = "baste_sound";
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* preference just won't persist */
  }
  window.dispatchEvent(new CustomEvent("baste:sound", { detail: on }));
}

function audio(): AudioContext | null {
  if (typeof window === "undefined" || !soundEnabled()) return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBuffer(ac: AudioContext, seconds: number): AudioBuffer {
  const buf = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** A filtered noise burst — the body of most cloth/paper sounds. */
function burst(ac: AudioContext, at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = "bandpass") {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, dur);
  const f = ac.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(master!);
  src.start(at);
  src.stop(at + dur + 0.02);
}

function tone(ac: AudioContext, at: number, dur: number, from: number, to: number, gain: number, type: OscillatorType = "sine") {
  const o = ac.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(from, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  const g = ac.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** `pitch` (0..1) lets a value drive the sound, e.g. a slider position. */
export function play(sound: Sound, pitch = 0.5) {
  const ac = audio();
  if (!ac || !master) return;
  const t = ac.currentTime + 0.005;
  switch (sound) {
    case "tick": // a light tap on the cutting table
      burst(ac, t, 0.035, 2400 + pitch * 1600, 3, 0.35);
      break;
    case "pin": // pin pushed into a cushion: soft thunk + tiny metallic glint
      burst(ac, t, 0.06, 700, 1.2, 0.5, "lowpass");
      tone(ac, t + 0.01, 0.09, 3100 + pitch * 900, 2800, 0.05, "triangle");
      break;
    case "snip": // shears: two blades, a crisp double transient
      burst(ac, t, 0.05, 5200, 6, 0.55);
      burst(ac, t + 0.055, 0.07, 3800, 5, 0.45);
      tone(ac, t + 0.05, 0.05, 1400, 900, 0.04, "square");
      break;
    case "thread": // thread pulled taut: rising, airy
      burst(ac, t, 0.22, 900 + pitch * 1800, 9, 0.22);
      tone(ac, t, 0.22, 380 + pitch * 420, 520 + pitch * 700, 0.035, "triangle");
      break;
    case "chalk": // chalk stroke on cloth
      burst(ac, t, 0.12, 3200, 0.8, 0.18, "highpass");
      break;
    case "error": // a dropped pin
      tone(ac, t, 0.12, 330, 190, 0.08, "triangle");
      tone(ac, t + 0.11, 0.16, 250, 150, 0.06, "triangle");
      break;
    case "fanfare": // finished garment: three plucked threads
      [523, 659, 784].forEach((f, i) => tone(ac, t + i * 0.085, 0.4, f, f * 0.995, 0.06, "triangle"));
      burst(ac, t, 0.05, 5200, 6, 0.3);
      break;
  }
}

export function haptic(pattern: number | number[] = 8) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}

/* ─── Particles ─────────────────────────────────────────────────────────── */

interface Particle {
  x: number; y: number; vx: number; vy: number; rot: number; vr: number;
  life: number; max: number; len: number; color: string; kind: "stitch" | "dust" | "pin";
}

let pcanvas: HTMLCanvasElement | null = null;
let pctx: CanvasRenderingContext2D | null = null;
let parts: Particle[] = [];
let praf = 0;

function ensureCanvas() {
  if (pcanvas) return;
  pcanvas = document.createElement("canvas");
  pcanvas.setAttribute("aria-hidden", "true");
  Object.assign(pcanvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "9998" });
  document.body.appendChild(pcanvas);
  pctx = pcanvas.getContext("2d");
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    pcanvas!.width = Math.round(innerWidth * dpr);
    pcanvas!.height = Math.round(innerHeight * dpr);
    pctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);
}

function stepParticles() {
  praf = 0;
  if (!pctx || !pcanvas) return;
  pctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.life < p.max);
  for (const p of parts) {
    p.life++;
    p.vy += p.kind === "dust" ? 0.02 : 0.22;
    p.vx *= p.kind === "dust" ? 0.96 : 0.985;
    p.x += p.vx;
    p.y += p.vy;
    p.rot += p.vr;
    const a = 1 - p.life / p.max;
    pctx.save();
    pctx.globalAlpha = Math.max(0, a);
    pctx.translate(p.x, p.y);
    pctx.rotate(p.rot);
    if (p.kind === "dust") {
      pctx.fillStyle = p.color;
      pctx.beginPath();
      pctx.arc(0, 0, p.len, 0, Math.PI * 2);
      pctx.fill();
    } else {
      pctx.strokeStyle = p.color;
      pctx.lineWidth = 2;
      pctx.lineCap = "round";
      pctx.beginPath();
      pctx.moveTo(-p.len / 2, 0);
      pctx.quadraticCurveTo(0, p.len * 0.25, p.len / 2, 0);
      pctx.stroke();
    }
    pctx.restore();
  }
  if (parts.length) praf = requestAnimationFrame(stepParticles);
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Snipped thread ends burst from a point. */
export function snipBurst(x: number, y: number, colors = ["#D2402A", "#A9311E", "#1C1B19"], count = 14) {
  if (reducedMotion()) return;
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.4;
    const sp = 2.5 + Math.random() * 4.5;
    parts.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.4,
      life: 0, max: 38 + Math.random() * 24, len: 6 + Math.random() * 8, color: colors[i % colors.length], kind: "stitch",
    });
  }
  if (!praf) praf = requestAnimationFrame(stepParticles);
}

/** A soft puff of tailor's chalk dust. */
export function chalkPuff(x: number, y: number, color = "rgba(47,85,164,0.55)", count = 18) {
  if (reducedMotion()) return;
  ensureCanvas();
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 0.4 + Math.random() * 1.8;
    parts.push({
      x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.6, rot: 0, vr: 0,
      life: 0, max: 40 + Math.random() * 30, len: 1 + Math.random() * 2.2, color, kind: "dust",
    });
  }
  if (!praf) praf = requestAnimationFrame(stepParticles);
}

/** Run a DOM change as a view transition (FLIP for free) where supported. */
export function transition(update: () => void | Promise<void>) {
  const d = document as Document & { startViewTransition?: (cb: () => void | Promise<void>) => unknown };
  if (!d.startViewTransition || reducedMotion()) {
    void update();
    return;
  }
  d.startViewTransition(update);
}
