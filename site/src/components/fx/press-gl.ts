/**
 * Press effects: one shared, transparent WebGL overlay that draws a short
 * material response over whichever control was pressed. Each action verb has
 * its own effect, so a press says what kind of thing just happened:
 *
 *   ripple — a pin pressed into cloth (select, toggle, tab)
 *   snip   — shears cut through the control (commit: save, create, generate)
 *   stitch — a loose running stitch sews round it (safe, reversible tries)
 *   chalk  — a grainy chalk stroke across it (copy, export, download)
 *   dye    — dye blooms out with a darker tide-line (choosing a persona)
 *   unpick — the stitches pull out of its edge (destructive)
 *
 * One context for the whole page (browsers cap live WebGL contexts), one quad
 * per live effect, and nothing drawn once the last effect has faded.
 */

export type PressKind = "ripple" | "snip" | "stitch" | "chalk" | "dye" | "unpick";

const KINDS: Record<PressKind, number> = { ripple: 0, snip: 1, stitch: 2, chalk: 3, dye: 4, unpick: 5 };
const DURATION: Record<PressKind, number> = { ripple: 700, snip: 620, stitch: 900, chalk: 760, dye: 1100, unpick: 820 };
// how far past the element's box each effect may draw
const BLEED: Record<PressKind, number> = { ripple: 6, snip: 4, stitch: 10, chalk: 4, dye: 2, unpick: 22 };

interface Effect {
  kind: PressKind;
  el: Element;
  ox: number;
  oy: number;
  color: [number, number, number];
  start: number;
  seed: number;
  radius: number;
}

const VERT = `
attribute vec2 aPos;
uniform vec2 uView;
varying vec2 vPx;
void main() {
  vPx = aPos;
  vec2 clip = aPos / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAG = `
precision mediump float;
varying vec2 vPx;
uniform vec4 uRect;     // x, y, w, h in CSS px
uniform vec2 uOrigin;   // press point, CSS px
uniform vec3 uColor;
uniform float uAge;     // 0..1
uniform float uKind;
uniform float uSeed;
uniform float uRadius;  // element corner radius

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
// signed distance to the element's rounded box (negative inside)
float box(vec2 p) {
  vec2 c = uRect.xy + uRect.zw * 0.5;
  vec2 q = abs(p - c) - uRect.zw * 0.5 + uRadius;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
}
// position along the box outline, in px, so dashes run round the edge
float along(vec2 p) {
  vec2 c = uRect.xy + uRect.zw * 0.5;
  vec2 d = p - c;
  vec2 h = uRect.zw * 0.5;
  if (abs(d.x) / h.x > abs(d.y) / h.y) return (d.x > 0.0 ? 1.0 : -1.0) * d.y + (d.x > 0.0 ? 0.0 : 2.0 * h.y + 2.0 * h.x);
  return (d.y > 0.0 ? -1.0 : 1.0) * d.x + (d.y > 0.0 ? h.y + h.x : 0.0);
}

void main() {
  vec2 p = vPx;
  float d = box(p);
  float inside = 1.0 - smoothstep(-0.5, 0.5, d);
  float t = uAge;
  float fade = 1.0 - t;
  vec3 col = uColor;
  float a = 0.0;

  if (uKind < 0.5) {
    // ripple: rings travelling out from the pin, shading the cloth light/dark
    float r = distance(p, uOrigin);
    float front = t * (uRect.z * 0.9 + 40.0);
    float wave = sin((r - front) * 0.32) * exp(-abs(r - front) * 0.05);
    col = wave > 0.0 ? vec3(1.0) : uColor;
    a = abs(wave) * 0.38 * fade * fade * inside;
  } else if (uKind < 1.5) {
    // snip: a cut line runs out both ways from the press, edges fraying
    float reach = t * 1.6 * uRect.z;
    float dx = abs(p.x - uOrigin.x);
    float fray = (noise(vec2(p.x * 0.35, uSeed)) - 0.5) * 3.0 * t;
    float dy = abs(p.y - uOrigin.y - fray);
    float open = mix(0.6, 2.4, smoothstep(0.0, 0.5, t));
    float cut = (1.0 - smoothstep(open, open + 1.2, dy)) * step(dx, reach);
    // the blades' shadow either side of the cut
    float shade = (1.0 - smoothstep(open + 1.0, open + 4.0, dy)) * step(dx, reach) * (1.0 - cut);
    col = mix(uColor * 0.25, vec3(1.0, 0.98, 0.94), cut);
    a = max(cut * 0.95, shade * 0.35) * smoothstep(1.0, 0.55, t) * (1.0 - smoothstep(-1.0, 1.5, d));
  } else if (uKind < 2.5) {
    // stitch: a dashed running stitch sews itself round the edge
    float s = along(p);
    float line = 1.0 - smoothstep(0.9, 1.9, abs(d - 4.0));
    float dash = step(fract(s / 9.0 + t * 0.6), 0.55);
    float sewn = step(distance(p, uOrigin), t * 2.2 * (uRect.z + uRect.w));
    a = line * dash * sewn * smoothstep(1.0, 0.7, t);
  } else if (uKind < 3.5) {
    // chalk: a grainy diagonal stroke dragged through the press point
    vec2 q = p - uOrigin;
    float along_ = q.x * 0.94 + q.y * 0.34;
    float across = -q.x * 0.34 + q.y * 0.94;
    float drawn = smoothstep(-uRect.z, uRect.z * (t * 2.0 - 0.6), along_ + uRect.z * 0.5);
    float band = 1.0 - smoothstep(uRect.w * 0.18, uRect.w * 0.34, abs(across + sin(along_ * 0.05) * 2.0));
    float grain = step(0.42, noise(p * 0.9) * 0.6 + hash(floor(p)) * 0.5);
    a = band * grain * drawn * 0.55 * fade * inside;
  } else if (uKind < 4.5) {
    // dye: colour soaks out from the press; pigment gathers at the wet edge
    float r = distance(p, uOrigin);
    float reach = (0.15 + 1.1 * (1.0 - pow(1.0 - t, 3.0))) * max(uRect.z, uRect.w);
    float edge = reach * (0.82 + 0.3 * fbm(p * 0.035 + uSeed));
    float wet = 1.0 - smoothstep(edge - 1.5, edge + 1.5, r);
    float tide = exp(-pow((r - edge) / 3.0, 2.0));
    a = (wet * 0.22 + tide * 0.45) * (1.0 - smoothstep(0.55, 1.0, t)) * inside;
  } else {
    // unpick: the edge stitches loosen, lift and fall away
    float s = along(p);
    float k = floor(s / 9.0);
    float lift = t * t * (10.0 + 18.0 * hash(vec2(k, 3.0)));
    float line = 1.0 - smoothstep(0.8, 1.8, abs(d - 3.0 - lift));
    float dash = step(fract(s / 9.0), 0.55);
    float gone = step(hash(vec2(k, 7.0)), 1.15 - t * 1.25);
    a = line * dash * gone * fade;
  }

  gl_FragColor = vec4(col * a, a);
}`;

let canvas: HTMLCanvasElement | null = null;
let gl: WebGLRenderingContext | null = null;
let failed = false;
let effects: Effect[] = [];
let raf = 0;
let buf: WebGLBuffer | null = null;
const U: Record<string, WebGLUniformLocation | null> = {};

function compile(g: WebGLRenderingContext, type: number, src: string) {
  const sh = g.createShader(type)!;
  g.shaderSource(sh, src);
  g.compileShader(sh);
  if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(sh) ?? "shader");
  return sh;
}

function init(): boolean {
  if (gl) return true;
  if (failed || typeof document === "undefined") return false;
  try {
    canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.dataset.fx = "press";
    Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "9997" });
    gl = canvas.getContext("webgl", { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) throw new Error("no webgl");
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error("link");
    gl.useProgram(prog);
    for (const n of ["uView", "uRect", "uOrigin", "uColor", "uAge", "uKind", "uSeed", "uRadius"]) U[n] = gl.getUniformLocation(prog, n);
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    document.body.appendChild(canvas);
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(innerWidth * dpr);
      canvas!.height = Math.round(innerHeight * dpr);
    };
    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("webglcontextlost", () => {
      failed = true;
      gl = null;
      canvas?.remove();
    });
    return true;
  } catch {
    failed = true;
    canvas?.remove();
    gl = null;
    return false;
  }
}

function frame(now: number) {
  raf = 0;
  if (!gl || !canvas) return;
  effects = effects.filter((e) => now - e.start < DURATION[e.kind] && e.el.isConnected);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.uniform2f(U.uView, innerWidth, innerHeight);
  for (const e of effects) {
    const r = e.el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) continue;
    const b = BLEED[e.kind];
    const x0 = r.left - b, y0 = r.top - b, x1 = r.right + b, y1 = r.bottom + b;
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([x0, y0, x1, y0, x0, y1, x1, y1]), gl.DYNAMIC_DRAW);
    gl.uniform4f(U.uRect, r.left, r.top, r.width, r.height);
    // the press point travels with the element if the page scrolls
    gl.uniform2f(U.uOrigin, r.left + e.ox, r.top + e.oy);
    gl.uniform3f(U.uColor, ...e.color);
    gl.uniform1f(U.uAge, Math.min(1, (now - e.start) / DURATION[e.kind]));
    gl.uniform1f(U.uKind, KINDS[e.kind]);
    gl.uniform1f(U.uSeed, e.seed);
    gl.uniform1f(U.uRadius, Math.min(e.radius, r.width / 2, r.height / 2));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  if (effects.length) raf = requestAnimationFrame(frame);
  else gl.clear(gl.COLOR_BUFFER_BIT);
}

function rgb(color: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (m) {
    const n = parseInt(m[1], 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const c = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(color);
  return c ? [Number(c[1]) / 255, Number(c[2]) / 255, Number(c[3]) / 255] : [0.11, 0.106, 0.098];
}

const COLORS: Record<PressKind, string> = {
  ripple: "#1C1B19",
  snip: "#1C1B19",
  stitch: "#D2402A",
  chalk: "#2F55A4",
  dye: "#D2402A",
  unpick: "#A9311E",
};

/** Draw `kind` over `el`, starting from the client point (x, y). */
export function press(kind: PressKind, el: Element, x?: number, y?: number, color?: string) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!init()) return;
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  effects.push({
    kind,
    el,
    ox: (x ?? r.left + r.width / 2) - r.left,
    oy: (y ?? r.top + r.height / 2) - r.top,
    color: rgb(color ?? COLORS[kind]),
    start: performance.now(),
    seed: Math.random() * 100,
    radius,
  });
  if (effects.length > 10) effects.shift();
  if (!raf) raf = requestAnimationFrame(frame);
}
