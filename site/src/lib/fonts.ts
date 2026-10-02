/**
 * Every family the token engine (src/assets/design-system.ts) can emit, so a
 * fitting renders in the persona's real faces rather than a fallback.
 * Keep in sync with TOKEN_FONT_FAMILIES on the engine side.
 */
const PERSONA_FAMILIES = [
  "Archivo+Black",
  "Bricolage+Grotesque:opsz,wght@12..96,400..800",
  "Chakra+Petch:wght@400;600;700",
  "Dela+Gothic+One",
  "Fira+Code:wght@400;500",
  "Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900",
  "IBM+Plex+Sans:wght@400;500;600",
  "Inter:wght@400;500;600;700",
  "Inter+Tight:wght@500;600;700",
  "JetBrains+Mono:wght@400;500",
  "Monoton",
  "Source+Serif+4:opsz,wght@8..60,400..700",
  "Space+Mono:wght@400;700",
  "VT323",
];

export const PERSONA_FONTS_HREF =
  "https://fonts.googleapis.com/css2?" +
  PERSONA_FAMILIES.map((f) => `family=${f}`).join("&") +
  "&display=swap";

/** First family name in a CSS font stack, unquoted: "'Fraunces', serif" → "Fraunces". */
export function primaryFamily(stack: string | undefined): string {
  if (!stack) return "";
  return stack.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}
