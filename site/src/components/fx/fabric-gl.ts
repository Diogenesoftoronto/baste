/**
 * Woven fabric, rendered in a fragment shader.
 *
 * - Plain weave at thread scale: warp and weft can be dyed different
 *   colours, so the cloth shifts hue with the folds like shot silk.
 * - A draped height field (slow, breathing folds) lit from the upper left
 *   with a soft sheen.
 * - The cloth gathers toward the pointer and ripples outward from it.
 *
 * Framework-free so both the page backdrop and the persona swatches can use it.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision highp float;
uniform vec2  uRes;
uniform float uTime;
uniform vec2  uMouse;     // fabric-space pointer
uniform float uMouseAmt;  // 0..1, eases in when the pointer is over the cloth
uniform vec3  uWarp;
uniform vec3  uWeft;
uniform vec3  uGround;
uniform float uDye;       // how much of the warp/weft colour shows over the ground
uniform float uFold;      // fold depth
uniform float uWeave;     // thread micro-shading strength
uniform float uThread;    // thread width in device px
uniform float uScale;     // folds per screen height
uniform float uScroll;    // parallax offset
uniform float uGrain;
uniform float uPattern;
uniform float uSeed;
uniform float uDensity;
uniform float uPulse;
uniform vec2 uTap;
uniform float uHue;
uniform float uColourSpace;

const float PI = 3.14159265;

float hash(vec2 p) { p += vec2(uSeed * 0.013, uSeed * 0.021); return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; }
  return v;
}

float height(vec2 p) {
  vec2 original = p;
  p += vec2(uSeed * 0.007, uSeed * 0.011);
  float t = uTime * 0.11;
  float w = fbm(p * 0.6 + vec2(t, -t * 0.7));
  float folds = sin(p.x * 2.1 + p.y * 0.55 + w * 3.2 + t * 1.4) * 0.55
              + sin(p.x * 3.9 - p.y * 1.25 + w * 2.1 - t * 0.9) * 0.22
              + (fbm(p * 1.7 - t) - 0.5) * 0.35;
  vec2 d = original - uMouse;
  float r2 = dot(d, d);
  float pinch = exp(-r2 * 2.2);
  float ripple = sin(sqrt(r2) * 10.0 - uTime * 2.6) * exp(-r2 * 1.3) * 0.16;
  return (folds - (pinch * 0.75 - ripple) * uMouseAmt) * uFold;
}

vec3 rgbToHsv(vec3 c) {
  vec4 K = vec4(0., -1./3., 2./3., -1.);
  vec4 p = mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));
  vec4 q = mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));
  float d=q.x-min(q.w,q.y),e=1.e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.*d+e)),d/(q.x+e),q.x);
}
vec3 hsvToRgb(vec3 c) { vec3 p=abs(fract(c.xxx+vec3(0.,2./3.,1./3.))*6.-3.); return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y); }
vec3 lab(vec3 c) {
  c=pow(max(c,vec3(0.)),vec3(2.2));
  vec3 l=pow(mat3(.41222147,.2119035,.08830246,.53633254,.68069955,.28171884,.05144599,.10739696,.6299787)*c,vec3(1./3.));
  return mat3(.21045426,1.9779985,.02590404,.7936178,-2.4285922,.78277177,-.00407205,.4505937,-.80867577)*l;
}
vec3 fromLab(vec3 c) {
  vec3 l=mat3(1.,1.,1.,.39633778,-.10556135,-.08948418,.21580376,-.06385417,-1.29148555)*c;
  l=l*l*l;
  vec3 rgb=mat3(4.07674166,-1.268438,-.00419609,-3.30771159,2.6097574,-.70341861,.23096993,-.3413194,1.7076147)*l;
  return pow(max(rgb,vec3(0.)),vec3(1./2.2));
}
vec3 blend(vec3 a,vec3 b,float f) {
  if (uColourSpace<.5) return mix(a,b,f);
  if (uColourSpace<1.5) return fromLab(mix(lab(a),lab(b),f));
  vec3 x=rgbToHsv(a),y=rgbToHsv(b);
  float delta=mod(y.x-x.x+1.5,1.)-.5;
  return hsvToRgb(vec3(fract(x.x+delta*f),mix(x.yz,y.yz,f)));
}
vec3 tint(vec3 c) { vec3 h=rgbToHsv(c); h.x=fract(h.x+uHue); return hsvToRgb(h); }
// A shared dyed field; each technique uses the same colour and height vocabulary.
vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0);
  return blend(blend(uGround, tint(uWarp), smoothstep(0.02, 0.56, x)), tint(uWeft), smoothstep(0.52, 0.98, x));
}
vec3 material(vec2 p, vec2 uv) {
  float t = uTime * 0.16;
  vec2 drift = vec2(t * 0.6, -t * 0.35);
  vec2 d = p - uMouse;
  vec2 bend = d * exp(-dot(d,d) * 1.5) * uMouseAmt * uFold;
  float r = length(p - uTap);
  float impulse = sin(r * 15.0 - uPulse * 5.0) * exp(-r * 1.5) * exp(-uPulse * 1.8) * step(uPulse, 5.0);
  vec2 q = p + drift - bend + vec2(impulse * 0.16);
  vec2 warp = vec2(fbm(q * 1.6 + 9.0), fbm(q * 1.6 - 6.0)) - 0.44;
  q += warp * uFold * 2.4;
  float density = mix(8.0, 52.0, uDensity);
  float phase = uSeed * 0.017;
  vec3 col;
  if (uPattern < 1.5) {
    float field = q.y + sin(q.x * 1.7 + phase) * 0.24;
    float wave = sin(field * density + t);
    float line = 1.0 - smoothstep(0.02, mix(0.12, 0.38, uWeave), abs(wave));
    vec3 yarn = blend(tint(uWarp), tint(uWeft), smoothstep(-0.5, 0.5, sin(q.x * 0.8 + phase + t)));
    col = mix(uGround, yarn, line * uDye);
    col *= 0.94 + 0.06 * sin(field * 4.0);
  } else if (uPattern < 2.5) {
    // Two close frequencies form slow interference bands; the carrier is capped
    // below Nyquist at every preview resolution.
    density = min(density, uRes.y / max(uScale, 0.5) * 0.11);
    float a = sin(q.x * density + q.y * 2.0 + t);
    float b = sin((q.x * cos(0.16 + uFold * 0.2) + q.y * sin(0.16 + uFold * 0.2)) * density * 1.04 - t);
    float beat = a * b;
    col = mix(uGround, blend(tint(uWarp), tint(uWeft), smoothstep(-0.6,0.6,beat)), uDye * (0.25 + 0.75 * abs(beat)));
  } else if (uPattern < 3.5) {
    float field = fbm(q * 1.8 + phase) * 1.8;
    float band = fract(field * mix(5.0, 24.0, uDensity));
    float line = 1.0 - smoothstep(0.025, 0.11, min(band, 1.0-band));
    col = mix(uGround, blend(tint(uWarp),tint(uWeft),smoothstep(0.55,1.25,field)), line * uDye);
    col = mix(col, ramp(field * 0.5), 0.08 * uDye);
  } else if (uPattern < 4.5) {
    float bath = fbm(q * 2.2 + warp * 6.0 + phase);
    float veins = sin((q.x * 0.5 + bath * 3.4) * mix(3.0, 14.0, uDensity) + t);
    col = mix(uGround, ramp(veins * 0.5 + 0.5), uDye);
  } else {
    vec2 centre = vec2(uRes.x / uRes.y * 0.5, 0.5) * uScale;
    centre = mix(centre, uMouse, uMouseAmt * 0.55);
    vec2 delta = p - centre;
    float angle = atan(delta.y, delta.x);
    float spokes = floor(mix(12.0, 80.0, uDensity)) * 2.0;
    float pleat = sin(angle * spokes + length(delta) * uFold * 6.0 + phase + t + impulse * 4.0);
    col = mix(uGround, blend(tint(uWarp),tint(uWeft),pleat*0.5+0.5), uDye);
    col *= 0.8 + 0.2 * (pleat * 0.5 + 0.5);
  }
  col += (hash(gl_FragCoord.xy) - 0.5) * uGrain;
  return col;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = uRes.x / uRes.y;
  vec2 uv = frag / uRes;
  vec2 p = vec2(uv.x * aspect, uv.y + uScroll) * uScale;

  if (uPattern > 0.5) {
    gl_FragColor = vec4(material(p, uv), 1.0);
    return;
  }
  float e = 0.012;
  float hx = height(p + vec2(e, 0.0)) - height(p - vec2(e, 0.0));
  float hy = height(p + vec2(0.0, e)) - height(p - vec2(0.0, e));
  vec3 n = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.6));

  // plain weave
  vec2 wp = frag / uThread;
  vec2 cell = floor(wp);
  vec2 f = fract(wp);
  float over = mod(cell.x + cell.y, 2.0);          // 1: warp on top
  float across = over > 0.5 ? sin(f.x * PI) : sin(f.y * PI);
  float along  = over > 0.5 ? sin(f.y * PI) : sin(f.x * PI);
  float thread = clamp(across * (0.72 + 0.28 * along), 0.0, 1.0);
  float slub = noise(vec2(over > 0.5 ? cell.x : cell.y, 0.0) * 0.37) * 0.18; // uneven yarn

  // shot fabric: which yarn dominates depends on the fold angle
  float shot = smoothstep(-0.35, 0.35, n.x * 1.8 - n.y * 0.6 + (over - 0.5) * 0.5);
  vec3 yarn = blend(tint(uWeft), tint(uWarp), shot);
  vec3 base = mix(uGround, yarn, uDye);

  vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float sheen = pow(clamp(dot(n, H), 0.0, 1.0), 28.0);

  // threads narrower than ~2 device px alias into moiré: fade the weave out
  float aa = smoothstep(1.4, 3.2, uThread);
  float micro = mix(1.0, 0.78 + 0.32 * thread - slub, uWeave * aa);
  shot = mix(0.5, shot, aa);
  yarn = blend(tint(uWeft), tint(uWarp), shot);
  base = mix(uGround, yarn, uDye);
  // light the cloth relative to its fold depth so a flat bolt keeps its true colour
  float shade = mix(1.0, 0.62 + 0.5 * diff, clamp(uFold * 1.4, 0.0, 1.0));
  vec3 col = base * shade * micro;
  col += sheen * 0.18 * clamp(uFold * 1.4, 0.0, 1.0) * (0.6 + 0.4 * thread);

  // grain + soft vignette for depth
  col += (hash(frag + fract(uTime)) - 0.5) * uGrain;
  float vig = (1.0 - smoothstep(0.35, 1.25, length((uv - 0.5) * vec2(aspect, 1.0))));
  col *= mix(0.9, 1.0, vig);

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface FabricLook {
  warp: string;
  weft: string;
  ground: string;
  dye: number;
  fold: number;
  weave: number;
  /** thread width in CSS px */
  thread: number;
  scale: number;
  grain: number;
  pattern?: "cloth" | "flow" | "moire" | "contour" | "marble" | "radial";
  seed?: number;
  density?: number;
  speed?: number;
  motion?: boolean;
  interaction?: boolean;
  hue?: number;
  cycle?: boolean;
  colourSpace?: "rgb" | "oklab" | "hue";
}

export const LINEN: FabricLook = {
  warp: "#F3EEE4",
  weft: "#EAE3D5",
  ground: "#F1ECE2",
  dye: 1,
  fold: 0.3,
  weave: 0.25,
  thread: 2.2,
  scale: 1.3,
  grain: 0.014,
};

function hexToVec(hex: string): [number, number, number] {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0.9, 0.88, 0.84];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

interface Options {
  /** Render-resolution multiplier relative to devicePixelRatio (perf). */
  quality?: number;
  /** Follow window scroll for parallax. */
  parallax?: number;
  /** Track the pointer across the whole window instead of just the canvas. */
  windowPointer?: boolean;
  exportable?: boolean;
}

export interface FabricHandle {
  setLook(look: Partial<FabricLook>): void;
  snapshot(): Promise<Blob>;
  destroy(): void;
}

export function mountFabric(
  canvas: HTMLCanvasElement,
  initial: FabricLook,
  opts: Options = {},
): FabricHandle | null {
  const gl = canvas.getContext("webgl", {
    antialias: false,
    alpha: false,
    premultipliedAlpha: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: opts.exportable ?? false,
  });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("[fabric]", gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.deleteProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    res: u("uRes"),
    time: u("uTime"),
    mouse: u("uMouse"),
    mouseAmt: u("uMouseAmt"),
    warp: u("uWarp"),
    weft: u("uWeft"),
    ground: u("uGround"),
    dye: u("uDye"),
    fold: u("uFold"),
    weave: u("uWeave"),
    thread: u("uThread"),
    scale: u("uScale"),
    scroll: u("uScroll"),
    grain: u("uGrain"),
    pattern: u("uPattern"),
    seed: u("uSeed"),
    density: u("uDensity"),
    pulse: u("uPulse"),
    tap: u("uTap"),
    hue: u("uHue"),
    colourSpace: u("uColourSpace"),
  };

  // current (eased) and target looks
  const cur = {
    warp: hexToVec(initial.warp),
    weft: hexToVec(initial.weft),
    ground: hexToVec(initial.ground),
    dye: initial.dye,
    fold: initial.fold,
    weave: initial.weave,
  };
  const target = {
    ...cur,
    warp: [...cur.warp],
    weft: [...cur.weft],
    ground: [...cur.ground],
  } as typeof cur;
  let thread = initial.thread;
  let scale = initial.scale;
  let grain = initial.grain;

  const patterns = ["cloth", "flow", "moire", "contour", "marble", "radial"];
  let pattern = patterns.indexOf(initial.pattern ?? "cloth");
  let seed = initial.seed ?? 0,
    density = initial.density ?? 0.5,
    speed = initial.speed ?? 1;
  let hue = initial.hue ?? 0,
    cycle = initial.cycle ?? false,
    colourSpace = initial.colourSpace ?? "rgb";
  let motion = initial.motion ?? true,
    interaction = initial.interaction ?? true;
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  let elapsed = 12,
    pulse = 99,
    tapX = -10,
    tapY = -10,
    destroyed = false;
  const active = () => motion && !reduced && speed > 0;
  const quality = opts.quality ?? 0.6;
  let w = 0,
    h = 0,
    dpr = 1;
  let raf = 0;
  let needsFrame = true;
  let visible = true;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2) * quality;
    w = Math.max(1, Math.round(rect.width * dpr));
    h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl.viewport(0, 0, w, h);
    needsFrame = true;
    kick();
  };

  const mouse = { x: -10, y: -10, tx: -10, ty: -10, amt: 0, tAmt: 0 };
  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    const inside =
      e.clientX >= rect.left &&
      e.clientX <= rect.right &&
      e.clientY >= rect.top &&
      e.clientY <= rect.bottom;
    const aspect = rect.width / Math.max(1, rect.height);
    const ux = (e.clientX - rect.left) / rect.width;
    const uy = 1 - (e.clientY - rect.top) / rect.height;
    mouse.tx = ux * aspect * scale;
    mouse.ty = (uy + scrollOff()) * scale;
    mouse.tAmt =
      interaction && !reduced && (opts.windowPointer || inside) ? 1 : 0;
    needsFrame = true;
    kick();
  };
  const onLeave = () => {
    mouse.tAmt = 0;
    needsFrame = true;
    kick();
  };
  const onDown = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    if (
      !interaction ||
      reduced ||
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      return;
    onMove(e);
    tapX = mouse.tx;
    tapY = mouse.ty;
    pulse = 0;
    kick();
  };
  const scrollOff = () =>
    opts.parallax
      ? (window.scrollY / Math.max(1, window.innerHeight)) * opts.parallax
      : 0;

  window.addEventListener("pointermove", onMove, { passive: true });
  document.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("pointerdown", onDown);
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) kick();
  });
  io.observe(canvas);
  const onVis = () => {
    if (!document.hidden) kick();
  };
  document.addEventListener("visibilitychange", onVis);
  const onScroll = () => {
    needsFrame = true;
    kick();
  };
  if (opts.parallax)
    window.addEventListener("scroll", onScroll, { passive: true });

  const t0 = performance.now();
  let last = t0;

  const ease = (a: number, b: number, k: number) => a + (b - a) * k;
  const draw = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const k = reduced || !motion ? 1 : 1 - Math.exp(-dt * 6);
    if (active()) elapsed += dt * speed;
    pulse += dt;
    for (const key of ["warp", "weft", "ground"] as const) {
      for (let i = 0; i < 3; i++)
        cur[key][i] = ease(cur[key][i], target[key][i], k);
    }
    cur.dye = ease(cur.dye, target.dye, k);
    cur.fold = ease(cur.fold, target.fold, k);
    cur.weave = ease(cur.weave, target.weave, k);
    mouse.x = ease(mouse.x, mouse.tx, 1 - Math.exp(-dt * 6));
    mouse.y = ease(mouse.y, mouse.ty, 1 - Math.exp(-dt * 6));
    mouse.amt = ease(mouse.amt, mouse.tAmt, 1 - Math.exp(-dt * 2.5));

    gl.uniform2f(U.res, w, h);
    gl.uniform1f(U.time, elapsed);
    gl.uniform1f(U.pattern, pattern);
    gl.uniform1f(U.hue, hue / 360 + (cycle ? (elapsed - 12) * 0.04 : 0));
    gl.uniform1f(U.colourSpace, ["rgb", "oklab", "hue"].indexOf(colourSpace));
    gl.uniform1f(U.seed, seed);
    gl.uniform1f(U.density, density);
    gl.uniform1f(U.pulse, reduced ? 99 : pulse);
    gl.uniform2f(U.tap, tapX, tapY);
    gl.uniform2f(U.mouse, mouse.x, mouse.y);
    gl.uniform1f(U.mouseAmt, reduced || !interaction ? 0 : mouse.amt);
    gl.uniform3fv(U.warp, cur.warp);
    gl.uniform3fv(U.weft, cur.weft);
    gl.uniform3fv(U.ground, cur.ground);
    gl.uniform1f(U.dye, cur.dye);
    gl.uniform1f(U.fold, cur.fold);
    gl.uniform1f(U.weave, cur.weave);
    gl.uniform1f(U.thread, thread * dpr);
    gl.uniform1f(U.scale, scale);
    gl.uniform1f(U.scroll, scrollOff());
    gl.uniform1f(U.grain, grain);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const settling = () =>
    Math.abs(cur.dye - target.dye) > 0.002 ||
    Math.abs(cur.fold - target.fold) > 0.002 ||
    Math.abs(cur.weave - target.weave) > 0.002 ||
    (interaction &&
      !reduced &&
      (Math.abs(mouse.amt - mouse.tAmt) > 0.002 ||
        (mouse.tAmt > 0 &&
          (Math.abs(mouse.x - mouse.tx) > 0.002 ||
            Math.abs(mouse.y - mouse.ty) > 0.002)) ||
        pulse < 5)) ||
    (["warp", "weft", "ground"] as const).some((key) =>
      cur[key].some((v, i) => Math.abs(v - target[key][i]) > 0.002),
    );

  const loop = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    if (needsFrame || active() || settling()) {
      needsFrame = false;
      draw(now);
      if (active() || settling()) raf = requestAnimationFrame(loop);
    }
  };
  const kick = () => {
    if (!raf && !destroyed) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  };
  const onPreference = () => {
    reduced = media.matches;
    mouse.tAmt = 0;
    needsFrame = true;
    kick();
  };
  const onLost = (e: Event) => {
    e.preventDefault();
    cancelAnimationFrame(raf);
    raf = 0;
    canvas.dataset.ready = "false";
  };
  media.addEventListener("change", onPreference);
  canvas.addEventListener("webglcontextlost", onLost);
  resize();
  kick();

  return {
    setLook(look) {
      if (look.hue !== undefined) hue = look.hue;
      if (look.cycle !== undefined) cycle = look.cycle;
      if (look.colourSpace !== undefined) colourSpace = look.colourSpace;
      if (
        look.pattern !== undefined &&
        pattern !== patterns.indexOf(look.pattern)
      ) {
        pattern = Math.max(0, patterns.indexOf(look.pattern));
        elapsed = 12;
        pulse = 99;
      }
      if (look.seed !== undefined && seed !== look.seed) {
        seed = look.seed;
        elapsed = 12;
        pulse = 99;
      }
      if (look.density !== undefined) density = look.density;
      if (look.speed !== undefined) speed = look.speed;
      if (look.motion !== undefined) motion = look.motion;
      if (look.interaction !== undefined) {
        interaction = look.interaction;
        mouse.tAmt = 0;
      }
      if (look.warp) target.warp = hexToVec(look.warp);
      if (look.weft) target.weft = hexToVec(look.weft);
      if (look.ground) target.ground = hexToVec(look.ground);
      if (look.dye !== undefined) target.dye = look.dye;
      if (look.fold !== undefined) target.fold = look.fold;
      if (look.weave !== undefined) target.weave = look.weave;
      if (look.thread !== undefined) thread = look.thread;
      if (look.scale !== undefined) scale = look.scale;
      if (look.grain !== undefined) grain = look.grain;
      needsFrame = true;
      kick();
    },
    snapshot() {
      if (destroyed || gl.isContextLost())
        return Promise.reject(
          new Error("The preview is unavailable. Try reloading the page."),
        );
      draw(performance.now());
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob
              ? resolve(blob)
              : reject(new Error("Could not export this preview.")),
          "image/png",
        ),
      );
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("scroll", onScroll);
      media.removeEventListener("change", onPreference);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("webglcontextlost", onLost);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
