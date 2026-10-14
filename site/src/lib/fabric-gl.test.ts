import { test } from "node:test";
import assert from "node:assert/strict";
import { LINEN, mountFabric } from "../components/fx/fabric-gl";

test("fabric repaints backing-size changes before returning, including reduced motion and DPR", () => {
  const operations: string[] = [];
  const listeners = new Map<string, EventListener>();
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  let resize!: ResizeObserverCallback;
  let observerDisconnected = false;
  let preference!: () => void;
  const media = {
    matches: true,
    addEventListener(_name: string, fn: () => void) {
      preference = fn;
    },
    removeEventListener() {},
  };
  const win = {
    devicePixelRatio: 1,
    scrollY: 0,
    innerHeight: 600,
    matchMedia: () => media,
    addEventListener: (name: string, fn: EventListener) =>
      listeners.set(name, fn),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  const gl = new Proxy(
    {
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getShaderParameter: () => true,
      getProgramParameter: () => true,
      getAttribLocation: () => 0,
      getUniformLocation: () => null,
      viewport: () => operations.push("viewport"),
      drawArrays: () => operations.push("draw"),
      uniform3fv: (_location: unknown, values: number[]) => {
        assert.ok(
          values.every(
            (value) => Number.isFinite(value) && value >= 0 && value <= 1,
          ),
        );
      },
      getExtension: () => null,
      isContextLost: () => false,
    },
    {
      get(target, key) {
        return Reflect.get(target, key) ?? (() => {});
      },
    },
  );
  let width = 300,
    height = 150;
  const rect = { width: 800, height: 600 };
  const canvas = {
    get width() {
      return width;
    },
    set width(value: number) {
      width = value;
      operations.push("clear-width");
    },
    get height() {
      return height;
    },
    set height(value: number) {
      height = value;
      operations.push("clear-height");
    },
    getBoundingClientRect: () => rect,
    getContext: () => gl,
    addEventListener() {},
    removeEventListener() {},
    dataset: {},
  };
  const replacements = {
    window: win,
    document: {
      hidden: false,
      addEventListener() {},
      removeEventListener() {},
    },
    requestAnimationFrame: (fn: FrameRequestCallback) => {
      frames.set(++nextFrame, fn);
      return nextFrame;
    },
    cancelAnimationFrame: (id: number) => frames.delete(id),
    ResizeObserver: class {
      constructor(fn: ResizeObserverCallback) {
        resize = fn;
      }
      observe() {}
      disconnect() {
        observerDisconnected = true;
      }
    },
    IntersectionObserver: class {
      observe() {}
      disconnect() {}
    },
  };
  const originals = new Map(
    Object.keys(replacements).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  for (const [key, value] of Object.entries(replacements))
    Object.defineProperty(globalThis, key, { value, configurable: true });
  try {
    const handle = mountFabric(canvas as unknown as HTMLCanvasElement, LINEN, {
      quality: 0.5,
    });
    assert.ok(handle);
    assert.deepEqual(operations, [
      "clear-width",
      "clear-height",
      "viewport",
      "draw",
    ]);
    operations.length = 0;
    rect.height = 650; // Browser address bar exposes more viewport without changing width.
    resize([], {} as ResizeObserver);
    assert.deepEqual(operations, ["clear-height", "viewport", "draw"]);
    operations.length = 0;
    resize([], {} as ResizeObserver);
    assert.deepEqual(operations, []); // Duplicate/fractionally rounded notifications never clear.
    rect.height += 0.1;
    resize([], {} as ResizeObserver);
    assert.deepEqual(operations, []);
    win.devicePixelRatio = 2;
    listeners.get("resize")!(new Event("resize"));
    assert.deepEqual(operations, [
      "clear-width",
      "clear-height",
      "viewport",
      "draw",
    ]);
    assert.equal(width, 800);
    assert.equal(height, 650);
    operations.length = 0;
    // Static/reduced-motion renders settle without scheduling an endless loop.
    for (const [id, fn] of [...frames]) {
      frames.delete(id);
      fn(performance.now());
    }
    assert.equal(frames.size, 0);
    // A queued rAF timestamp can predate a synchronous resize draw. Easing
    // must not extrapolate colours or reverse the motion clock in that case.
    media.matches = false;
    preference();
    handle.setLook({ warp: "#000000" });
    for (const [id, fn] of [...frames]) {
      frames.delete(id);
      fn(performance.now() - 1000);
    }
    handle.destroy();
    assert.equal(listeners.size, 0);
    assert.equal(frames.size, 0);
    assert.equal(observerDisconnected, true);
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
