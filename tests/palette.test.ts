import { test } from "node:test";
import assert from "node:assert/strict";
import { generateDesignTokens, TOKEN_FONT_FAMILIES, exportCSS, exportTailwindConfig, exportPandaTheme } from "../dist/src/assets/design-system.js";
import { oklchToHex, toOklab, toOklch, hueDistance } from "../dist/src/assets/oklch.js";
import { contrastRatio, parseColor, relativeLuminance } from "../dist/src/assets/contrast.js";
import { basePersonas } from "../dist/src/persona/base-personas.js";
import type { Persona } from "../src/persona/types.js";

function unknownPersona(id: string): Persona {
  const persona = structuredClone(basePersonas.cyberbotanist);
  persona.id = id;
  persona.culture.subcultures = [];
  persona.influences = {
    films: [], anime: [], shows: [], games: [], visualArtists: [], fashion: [],
    music: { genres: [], artists: [] }, spaces: [], tools: [], obsessions: [],
  };
  persona.aesthetic.visualKeywords = ["unmapped reference xyz"];
  persona.aesthetic.moodKeywords = [];
  persona.aesthetic.colorTemperature = "neutral";
  return persona;
}

// Independent inverse conversion lets tests check the mapped hue and lightness.
function hexLab(hex: string) {
  const rgb = parseColor(hex)!;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  };
}

function checkPalette(persona: Persona) {
  const colors = generateDesignTokens(persona).colors;
  for (const [role, hex] of Object.entries(colors)) {
    if (role !== "density") assert.match(hex, /^#[0-9a-f]{6}$/i, `${persona.id}: ${role}`);
  }
  for (const [role, minimum] of [["text", 7], ["textMuted", 4.5], ["primary", 3]] as const) {
    const ratio = contrastRatio(parseColor(colors[role])!, parseColor(colors.background)!);
    assert.ok(ratio >= minimum, `${persona.id}: ${role} contrast ${ratio} < ${minimum}`);
  }
}

test("base personas have perceptually distinct primaries and the specified light/dark grounds", () => {
  const colors = Object.values(basePersonas).map((persona) => generateDesignTokens(persona).colors);
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      assert.notEqual(colors[i].primary, colors[j].primary);
      const a = hexLab(colors[i].primary);
      const b = hexLab(colors[j].primary);
      const deltaE = Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
      assert.ok(deltaE >= 0.1, `primary colours too similar: ΔE OK ${deltaE}`);
    }
  }
  assert.ok(relativeLuminance(parseColor(colors[0].background)!) > 0.8);
  assert.ok(relativeLuminance(parseColor(colors[1].background)!) < 0.05);
  assert.ok(relativeLuminance(parseColor(colors[2].background)!) < 0.05);
  Object.values(basePersonas).forEach(checkPalette);
});

test("contrast guarantees hold for 50 seeded synthetic personas across all temperatures", () => {
  let seed = 0x12345678;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const keywords = ["bioluminescence", "solarpunk", "neon", "night market", "glitch", "herbarium", "concrete", "vaporwave", "desert", "ocean", "unknown xyz"];
  const temperatures = ["warm", "cool", "neutral", "muted", "high-contrast"] as const;
  for (let i = 0; i < 50; i++) {
    const persona = unknownPersona(`synthetic-${i}`);
    persona.aesthetic.colorTemperature = temperatures[i % temperatures.length];
    const pick = () => keywords[Math.floor(random() * keywords.length)];
    persona.aesthetic.visualKeywords = Array.from({ length: Math.floor(random() * 6) }, pick);
    persona.influences.spaces = Array.from({ length: Math.floor(random() * 3) }, pick);
    persona.culture.subcultures = [pick()];
    persona.influences.films = [pick()];
    persona.aesthetic.moodKeywords = [pick()];
    checkPalette(persona);
  }
});

test("tokens are deterministic and generation does not mutate the persona", () => {
  for (const persona of [...Object.values(basePersonas), unknownPersona("custom")]) {
    const before = structuredClone(persona);
    assert.deepEqual(generateDesignTokens(persona), generateDesignTokens(structuredClone(persona)));
    assert.deepEqual(persona, before);
  }
});

test("unknown references seed distinct valid palettes from ids and visual keywords", () => {
  const a = unknownPersona("custom-alpha");
  const b = unknownPersona("custom-beta");
  checkPalette(a);
  checkPalette(b);
  assert.notEqual(generateDesignTokens(a).colors.primary, generateDesignTokens(b).colors.primary);
  b.id = a.id;
  b.aesthetic.visualKeywords = ["another unmapped xyz"];
  assert.notEqual(generateDesignTokens(a).colors.primary, generateDesignTokens(b).colors.primary);
});

test("base personas use their cultural heading fonts and specified body fonts", () => {
  const expected = {
    cyberbotanist: ["'Fraunces', serif", "'Source Serif 4', serif"],
    nightmarketcoder: ["'Dela Gothic One', sans-serif", "'Instrument Sans', sans-serif"],
    liminalweeb: ["'VT323', monospace", "'IBM Plex Sans', sans-serif"],
  };
  for (const [id, [heading, body]] of Object.entries(expected)) {
    const fonts = generateDesignTokens(basePersonas[id]).typography.fontFamily;
    assert.equal(fonts.heading, heading);
    assert.equal(fonts.body, body);
  }
});

test("all typography styles and overrides are included once in TOKEN_FONT_FAMILIES", () => {
  const expected = ["Inter Tight", "Inter", "JetBrains Mono", "Bricolage Grotesque", "Instrument Sans", "Fira Code", "Space Mono", "IBM Plex Sans", "VT323", "Chakra Petch", "Fraunces", "Source Serif 4", "Dela Gothic One", "Monoton", "Archivo Black"];
  assert.equal(TOKEN_FONT_FAMILIES.length, new Set(TOKEN_FONT_FAMILIES).size);
  assert.deepEqual([...TOKEN_FONT_FAMILIES].sort(), expected.sort());
  for (const [style, heading, body, mono] of [
    ["clean", "Inter Tight", "Inter", "JetBrains Mono"],
    ["expressive", "Bricolage Grotesque", "Instrument Sans", "Fira Code"],
    ["retro", "Space Mono", "IBM Plex Sans", "VT323"],
    ["futuristic", "Chakra Petch", "Inter", "JetBrains Mono"],
    ["handcrafted", "Fraunces", "Source Serif 4", "Fira Code"],
  ] as const) {
    const persona = unknownPersona(style);
    persona.aesthetic.typographyStyle = style;
    const fonts = generateDesignTokens(persona).typography.fontFamily;
    assert.ok(fonts.heading.startsWith(`'${heading}', `));
    assert.ok(fonts.body.startsWith(`'${body}', `));
    assert.equal(fonts.mono, `'${mono}', monospace`);
  }
});

test("cultural matching is case-insensitive, weighted, and limited to the specified corpus", () => {
  const persona = unknownPersona("weighting");
  persona.aesthetic.visualKeywords = ["VAPORWAVE"];
  persona.influences.films = ["glitch"];
  assert.equal(generateDesignTokens(persona).typography.fontFamily.heading, "'Monoton', sans-serif");
  persona.influences.spaces = ["glitch"];
  persona.influences.obsessions = ["glitch"];
  assert.equal(generateDesignTokens(persona).typography.fontFamily.heading, "'VT323', monospace");
  const tokens = generateDesignTokens(persona);
  persona.name = "night market";
  persona.summary = "synthwave";
  persona.influences.tools = ["botan"];
  persona.influences.music.artists = ["tokyo"];
  assert.deepEqual(generateDesignTokens(persona), tokens);
});

test("OKLCH conversion matches black, white, gray and sRGB red reference values", () => {
  assert.equal(oklchToHex({ l: 0, c: 0, h: 0 }), "#000000");
  assert.equal(oklchToHex({ l: 1, c: 0, h: 0 }), "#ffffff");
  assert.equal(oklchToHex({ l: 0.5, c: 0, h: 0 }), "#636363");
  assert.equal(oklchToHex({ l: 0.6279553606, c: 0.2576833077, h: 29.2338851923 }), "#ff0000");
  const original = { l: 0.6, c: 0.15, h: 359 };
  const roundtrip = toOklch(toOklab(original));
  assert.ok(Math.abs(roundtrip.l - original.l) < 1e-12);
  assert.ok(Math.abs(roundtrip.c - original.c) < 1e-12);
  assert.ok(hueDistance(roundtrip.h, original.h) < 1e-12);
  assert.equal(hueDistance(350, 10), 20);
});

test("gamut mapping reduces chroma while preserving hue and lightness", () => {
  for (let h = 0; h < 360; h += 15) {
    const mapped = toOklch(hexLab(oklchToHex({ l: 0.65, c: 0.4, h })));
    assert.ok(mapped.c < 0.4);
    assert.ok(Math.abs(mapped.l - 0.65) < 0.003);
    assert.ok(hueDistance(mapped.h, h) < 1);
  }
});

test("exports retain generated palette values and BrandKit overrides", () => {
  const persona = basePersonas.cyberbotanist;
  const colors = generateDesignTokens(persona).colors;
  for (const exported of [exportCSS(persona), exportTailwindConfig(persona), exportPandaTheme(persona)]) {
    for (const [role, color] of Object.entries(colors)) if (role !== "density") assert.ok(exported.includes(color));
  }
  const kit = { paletteRoles: { primary: "#123456" }, fonts: ["Custom Display", "Custom Body", "Custom Mono"] } as Parameters<typeof generateDesignTokens>[1];
  const tokens = generateDesignTokens(persona, kit);
  assert.equal(tokens.colors.primary, "#123456");
  assert.equal(tokens.colors.background, colors.background);
  assert.equal(tokens.typography.fontFamily.heading, "'Custom Display', serif");
  assert.equal(tokens.typography.fontFamily.body, "'Custom Body', serif");
  assert.equal(tokens.typography.fontFamily.mono, "'Custom Mono', monospace");
});
