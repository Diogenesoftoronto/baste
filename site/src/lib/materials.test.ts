import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_MATERIAL,
  MATERIAL_PRESETS,
  materialRecipe,
  normalizeMaterial,
  parseMaterialRecipe,
} from "./materials";

test("material recipes preserve every preset and colour behaviour without sharing state", () => {
  for (const { look } of MATERIAL_PRESETS) {
    const custom = {
      ...look,
      hue: 197,
      cycle: true,
      colourSpace: "hue" as const,
      motion: false,
    };
    const restored = parseMaterialRecipe(materialRecipe(custom));
    assert.deepEqual(restored, custom);
    restored.seed = 0;
    assert.notEqual(look.seed, 0);
  }
});
test("imported values cannot inject colours or send non-finite or excessive shader parameters", () => {
  const look = normalizeMaterial({
    warp: "url(https://example.test)",
    weft: "#abcdef",
    ground: "red",
    seed: 1e30,
    scale: -10,
    density: Infinity,
    fold: NaN,
    hue: 700,
    speed: -9,
    pattern: "unknown",
    motion: "false",
    interaction: false,
    cycle: "true",
    colourSpace: "unknown",
  });
  assert.equal(look.warp, DEFAULT_MATERIAL.warp);
  assert.equal(look.weft, "#ABCDEF");
  assert.equal(look.ground, DEFAULT_MATERIAL.ground);
  assert.equal(look.seed, 65535);
  assert.equal(look.scale, 0.5);
  assert.equal(look.density, DEFAULT_MATERIAL.density);
  assert.equal(look.fold, DEFAULT_MATERIAL.fold);
  assert.equal(look.hue, 360);
  assert.equal(look.speed, 0);
  assert.equal(look.pattern, DEFAULT_MATERIAL.pattern);
  assert.equal(look.motion, true);
  assert.equal(look.interaction, false);
  assert.equal(look.cycle, false);
  assert.equal(look.colourSpace, "oklab");
});
test("wrong recipe versions, kinds and malformed payloads fail before changing the material", () => {
  for (const value of [
    null,
    [],
    { version: 2, kind: "baste-procedural-material", look: {} },
    { version: 1, kind: "other", look: {} },
    { version: 1, kind: "baste-procedural-material", look: [] },
  ])
    assert.throws(() => parseMaterialRecipe(JSON.stringify(value)));
  assert.throws(() => parseMaterialRecipe("not json"));
});
