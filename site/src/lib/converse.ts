import type { DesignTokens, PersonaRecord } from "./api-types";
import { primaryFamily } from "./fonts";

/**
 * Talking with a persona.
 *
 * Each base persona speaks in the first person about its own taste, why its
 * fitting looks the way it does, and how Baste arrived there. Replies arrive
 * as a few short messages, the way a person texts, and some carry a small
 * piece of the design (palette, type, a step of the method) to look at.
 *
 * The local voice works without a server or model: every line is authored
 * from the persona's own measurements and generated tokens. When the Baste
 * server has a model configured, `/api/converse/:id` answers in the same
 * voice instead (see src/gui/converse.ts) and this stays the fallback.
 */

export type Attachment =
  | { kind: "palette"; swatches: Array<{ role: string; hex: string }> }
  | { kind: "type"; heading: string; body: string }
  | { kind: "garment" }
  | { kind: "steps"; active: number }
  | { kind: "judge" }
  | { kind: "link"; href: string; label: string };

export interface Bubble {
  text: string;
  attach?: Attachment;
}

export interface Turn extends Bubble {
  from: "them" | "you";
}

export interface Reply {
  topic: Topic;
  bubbles: Bubble[];
}

export type Topic =
  | "hello" | "who" | "influences" | "dislikes" | "colour" | "type" | "motion"
  | "density" | "process" | "judge" | "make" | "own" | "others" | "thanks" | "unknown";

/** The order a curious visitor tends to wander in; suggestions follow it. */
const FLOW: Topic[] = ["who", "influences", "colour", "dislikes", "type", "density", "motion", "process", "judge", "make", "own"];

const ASK: Record<Topic, string> = {
  hello: "Hi",
  who: "Who are you?",
  influences: "What are you into?",
  dislikes: "What do you hate in apps?",
  colour: "Why these colours?",
  type: "What's with the typeface?",
  motion: "How should things move?",
  density: "Why this much on screen?",
  process: "How did Baste make you?",
  judge: "How does it know it fits?",
  make: "What do I actually get?",
  own: "Can I make my own?",
  others: "Who else is here?",
  thanks: "Thanks!",
  unknown: "",
};

// Specific design subjects win over generic words like "work" and "how".
const MATCH: Array<[Topic, RegExp]> = [
  ["own", /\b(my own|own persona|bespoke|make one|create|custom|myself|my users?|my audience|my site|my brand|decompose|remix)\b/i],
  ["colour", /\b(colou?rs?|palette|hue|red|green|blue|pink|teal|neon|warm|cool|dark|light|background|accent)\b/i],
  ["type", /\b(type|typefaces?|fonts?|letters?|serif|sans|headline|heading|text style)\b/i],
  ["motion", /\b(motion|moves?|moving|animations?|animate|transitions?|speed|fast|slow|easing|scroll)\b/i],
  ["density", /\b(density|dense|busy|clutter|minimal|spacing|layout|grid|crowd|whitespace|much on)\b/i],
  ["dislikes", /\b(hate|dislikes?|annoy\w*|can't stand|cant stand|pet ?peeves?|worst|bad|ugh|avoid|never)\b/i],
  ["influences", /\b(into|like|love|influences?|films?|movies?|music|listen|watch|games?|anime|artists?|spaces?|rooms?|places?|obsessions?|favou?rites?|inspiration)\b/i],
  ["judge", /\b(judge|scores?|scoring|fits?|weights?|rate|quality|grade|evaluation|know it|good)\b/i],
  ["make", /\b(get|outputs?|assets?|deliver|files?|export|svg|icons?|images?|video|loops?|tokens?|tailwind|css|panda|ship|code)\b/i],
  ["process", /\b(how (did|does|do)|made|make you|baste|process|method|works?|evolution|quality.?diversity|archive|generation|steps?|pipeline|ai)\b/i],
  ["others", /\b(others?|someone else|who else|other personas?|switch|wardrobe)\b/i],
  ["who", /\b(who|what are you|about you|yourself|introduce|name|real|person|human)\b/i],
  ["hello", /^(hi|hey|hello|yo|sup|hiya|howdy|good (morning|evening|afternoon))\b/i],
  ["thanks", /\b(thanks|thank you|thx|ty|cheers|bye|see ya)\b/i],
];

export function classify(text: string): Topic {
  for (const [topic, re] of MATCH) if (re.test(text)) return topic;
  return "unknown";
}

/** Up to three next questions, skipping what has been covered. */
export function suggestions(covered: Topic[]): Array<{ topic: Topic; label: string }> {
  const next = FLOW.filter((t) => !covered.includes(t)).slice(0, 2);
  const out = next.map((t) => ({ topic: t, label: ASK[t] }));
  if (covered.length >= 3 && !covered.includes("others")) out.push({ topic: "others", label: ASK.others });
  else if (next.length < 2 && !covered.includes("own")) out.push({ topic: "own", label: ASK.own });
  return out.slice(0, 3);
}

export function askFor(topic: Topic): string {
  return ASK[topic];
}

interface Ctx {
  p: PersonaRecord;
  t: DesignTokens;
  heading: string;
  body: string;
  /** Pick one item, rotating so repeat questions don't repeat answers. */
  seen: number;
}

const pick = <T,>(xs: T[], n: number) => xs[n % xs.length];
const list = (xs: string[], n = 3) => {
  const s = xs.slice(0, n);
  return s.length <= 1 ? s.join("") : `${s.slice(0, -1).join(", ")} and ${s[s.length - 1]}`;
};
const palette = (t: DesignTokens): Attachment => ({
  kind: "palette",
  swatches: (["background", "surface", "primary", "secondary", "accent", "text"] as const).map((role) => ({ role, hex: t.colors[role] })),
});
const typeCard = (c: Ctx): Attachment => ({ kind: "type", heading: c.heading, body: c.body });

/** Each persona's voice: the same facts, said the way they would say them. */
interface Voice {
  handle: string;
  /** How they sign in: a short status line under the name. */
  status: string;
  greet: (c: Ctx) => Bubble[];
  lines: Record<Exclude<Topic, "hello">, (c: Ctx) => Bubble[]>;
}

const MOSS: Voice = {
  handle: "Moss",
  status: "in the greenhouse",
  greet: (c) => [
    { text: `Hi, I'm Moss, ${c.p.name.replace(/^The /, "the ")}. I study mycelium and keep a slightly overgrown greenhouse.` },
    { text: "This is what my corner of the internet feels like. Want to talk about the colours, or the films and field notes behind them?" },
  ],
  lines: {
    who: (c) => [
      { text: c.p.summary.replace(/They believe/, "I believe").replace(/^A biologist who studies/, "I study").replace(/, programs/, " and program") },
      { text: `Most of my thinking happens in ${list(c.p.influences.spaces, 2)}. Things that grow slowly and connect underneath.` },
      { text: "Give me enough room to follow a connection. I like finding the little details that reward a second look." },
    ],
    influences: (c) => [
      { text: `Films first: ${list(c.p.influences.films)}. Annihilation especially, for that shimmer where everything is slightly too alive.` },
      { text: `I listen to ${list(c.p.influences.music.artists, 3)} while I work. Ambient, field recordings, a harp if I'm lucky.` },
      { text: `And I keep coming back to ${pick(c.p.influences.obsessions, c.seen)}. Baste took all of that as measurements.` },
    ],
    dislikes: (c) => [
      { text: `Honestly? ${cap(list(c.p.behaviors.petPeeves, 4))}.` },
      { text: "Infinite scroll is the worst of them. It's a forest with no paths. I want to wander, but I want to know where I've been." },
      { text: "So my fitting has no feed. You arrive somewhere, and it stays put while you look." },
    ],
    colour: (c) => [
      { text: "My ground is a pinkish paper, like the inside of a mushroom cap. The warm brown comes from bark and old field notebooks.", attach: palette(c.t) },
      { text: "That bright mint is the bioluminescence. It's the only loud thing, and it's used sparingly, the way glow-in-the-dark fungi are rare." },
    ],
    type: (c) => [
      { text: `Headlines are ${c.heading}. It has soft, slightly wonky curves, like handwriting in a field notebook.`, attach: typeCard(c) },
      { text: `Body text is ${c.body}. I read long things and I want a serif that's patient with me.` },
    ],
    motion: () => [
      { text: "Give things a moment to settle. I don't want every change to demand my attention." },
      { text: "Growth doesn't jump. A panel should unfurl a little, then rest. If it bounces, it feels like a toy." },
    ],
    density: (c) => [
      { text: `I'm “${c.p.aesthetic.density}”: there's a lot here, but it's layered, like a herbarium page with notes in the margins.` },
      { text: "The corners are soft, too. Nothing in a forest has a perfect right angle.", attach: { kind: "garment" } },
    ],
    process: () => [
      { text: "Baste measured me first: my films, music, rooms and pet peeves. Then it drafted prompts for every kind of asset.", attach: { kind: "steps", active: 0 } },
      { text: "Then it tried a lot of loose versions of me. Warm and cool, sparse and dense, literal and abstract. It kept the best one in each corner instead of picking a single winner." },
      { text: "Like a tailor basting a garment before the final seam. That's the name." },
    ],
    judge: () => [
      { text: "Every candidate gets scored. Almost a third of the score is simply: does this feel like it was made for me?", attach: { kind: "judge" } },
      { text: "The rest is quality, uniqueness, coherence and whether it still works as an interface. Pretty and unusable doesn't pass." },
    ],
    make: () => [
      { text: "Icons, images and textures, ambient loops, and a set of colours and type that belong together." },
      { text: "There are files for your app, too. The Method page goes through the formats and how to use them.", attach: { kind: "link", href: "/method/#deliverables", label: "See the files" } },
    ],
    own: () => [
      { text: "Please do. Write one from scratch, extend one of us, cross two of us together, or start from a website you admire." },
      { text: "Bring the specific stuff: the film you rewatch, the room you'd live in. That's where the fit comes from.", attach: { kind: "link", href: "/gui?new=1", label: "Measure your own" } },
    ],
    others: () => [
      { text: "Ren is the night-market one: loud, fast, dense. Ada lives in abandoned malls and old websites." },
      { text: "We'd each hate each other's interfaces a little. That's the point. Pick one above to talk to them." },
    ],
    thanks: () => [{ text: "Any time. Go slowly." }],
    unknown: (c) => [
      { text: "Hm. I'm not sure I'm the right one to answer that." },
      { text: `I can tell you about my taste, the ${c.heading} type, my colours, or how Baste put me together.` },
    ],
  },
};

const REN: Voice = {
  handle: "Ren",
  status: "between stalls",
  greet: (c) => [
    { text: `Hey, I'm Ren, ${c.p.name.replace(/^The /, "the ")}. I build tools for the people running the stalls.` },
    { text: "A good market puts everything within reach. I want my apps to do that too. Ask me why this screen is so full of colour." },
  ],
  lines: {
    who: (c) => [
      { text: "grew up in night markets. now I build tools for small merchants, the uncle selling skewers, the auntie with the phone case stall" },
      { text: `I care about ${list(c.p.behaviors.interfaceValues, 3)}` },
      { text: "I'm a persona btw, not a real person. but I'm specific, which is better than “millennial urban professional”" },
    ],
    influences: (c) => [
      { text: `movies first. ${list(c.p.influences.films, 3)}. Chungking Express especially, that one is basically my whole palette` },
      { text: `${list(c.p.influences.music.genres, 3)} on while I code. loud enough to feel like a crowd` },
      { text: `games too, ${list(c.p.influences.games, 2)}. arcades, signage, steam coming off a wok at 1am` },
    ],
    dislikes: (c) => [
      { text: `${list(c.p.behaviors.petPeeves, 4)}` },
      { text: "minimalism that hides stuff is the worst. if a merchant needs 20 things, show 20 things. don't make them dig through three menus" },
      { text: "empty white screens feel like a closed shop to me" },
    ],
    colour: (c) => [
      { text: "ground is nearly black. it's night, obviously", attach: palette(c.t) },
      { text: "then lantern red, yellow shop signs, and pink for the neon that's half broken" },
      { text: "it's a lot. that's correct" },
    ],
    type: (c) => [
      { text: `headlines in ${c.heading}. thick, chunky, reads from across the street like a shop sign`, attach: typeCard(c) },
      { text: `body in ${c.body} so the prices stay readable. loud headline, honest numbers` },
    ],
    motion: () => [
      { text: "snappy. nobody at a market waits for a fade" },
      { text: "things should click into place. if I tap, I want it done before I think about it" },
    ],
    density: (c) => [
      { text: `${c.p.aesthetic.density}. yes on purpose`, attach: { kind: "garment" } },
      { text: "tight rows, small corners, every cell earns its spot. like a menu board with 80 items that still somehow works" },
    ],
    process: () => [
      { text: "ok fast version", attach: { kind: "steps", active: 2 } },
      { text: "measure me → draft a prompt per asset → generate tons of loose variations → judge them → cut the keepers" },
      { text: "the good bit is it keeps a spread. not one answer, a whole grid of options from calm to chaos. you pick" },
    ],
    judge: () => [
      { text: "score card. persona fit is 30%, the biggest slice", attach: { kind: "judge" } },
      { text: "usability is in there too, so it can't just make neon soup. it has to survive a real checkout" },
    ],
    make: () => [
      { text: "icons, images, little video loops, and tokens" },
      { text: "tokens as css / tailwind / panda / json. paste and go", attach: { kind: "link", href: "/method/#deliverables", label: "show me the files" } },
    ],
    own: () => [
      { text: "yes!! do it" },
      { text: "start from a site you like and Baste pulls out its palette and type. or remix two of us. me + Ada would be wild", attach: { kind: "link", href: "/gui?new=1", label: "make yours" } },
    ],
    others: () => [
      { text: "Moss: plants, slow, very calm, too calm. Ada: vaporwave ghost, loves dead links" },
      { text: "tap one of them up top" },
    ],
    thanks: () => [{ text: "anytime. go eat something" }],
    unknown: (c) => [
      { text: "lol no idea" },
      { text: `ask me about my colours, the ${c.heading} headlines, or why everything's so dense` },
    ],
  },
};

const ADA: Voice = {
  handle: "Ada",
  status: "last seen in an empty food court",
  greet: (c) => [
    { text: `hi, i'm ada, ${c.p.name.toLowerCase()}. i collect forgotten websites and photographs of empty malls.` },
    { text: "i like a screen that feels like somewhere you've been. ask me about the worn colours, or what i miss about the old internet." },
  ],
  lines: {
    who: (c) => [
      { text: "i'm a designer who collects the in-between. empty malls after close, hotel corridors, geocities pages nobody updates." },
      { text: `i value ${list(c.p.behaviors.interfaceValues, 3)}.` },
      { text: "i'm a persona. a character made of taste. which is maybe more honest than a stock photo of a user." },
    ],
    influences: (c) => [
      { text: `${list(c.p.influences.anime.length ? c.p.influences.anime : c.p.influences.films, 2)}. lain mostly. wired, quiet, a little wrong.` },
      { text: `${list(c.p.influences.games, 2)}. walking around places where nothing happens.` },
      { text: `and ${pick(c.p.influences.obsessions, c.seen)}. i'll go on about that for hours.` },
    ],
    dislikes: (c) => [
      { text: `${list(c.p.behaviors.petPeeves, 4)}.` },
      { text: "everything got so smooth. flat and frictionless and the same. i miss when websites had fingerprints." },
      { text: "so my fitting has grain on it. on purpose. like a tape that's been played too many times." },
    ],
    colour: (c) => [
      { text: "the ground is the colour of an old monitor that's switched off but still warm.", attach: palette(c.t) },
      { text: "the teal is pool water under fluorescent light. the pink feels like a faded poster in an empty arcade." },
    ],
    type: (c) => [
      { text: `headlines in ${c.heading}. pixel type, like a bios screen or a teletext page.`, attach: typeCard(c) },
      { text: `then ${c.body} for reading, so it's nostalgic but not a joke.` },
    ],
    motion: () => [
      { text: "slow. things should drift in like a memory loading." },
      { text: "slowness is a feature. a little latency feels like a place, not an app." },
    ],
    density: (c) => [
      { text: `${c.p.aesthetic.density}. lots of empty floor. that's the liminal part.`, attach: { kind: "garment" } },
      { text: `${c.p.aesthetic.layoutStyle} too. things sit a little off-centre, like furniture someone moved and never put back.` },
    ],
    process: () => [
      { text: "baste took my measurements. films, rooms, what i hate.", attach: { kind: "steps", active: 1 } },
      { text: "then it made dozens of loose drafts across temperature, density and how abstract they are, and kept the best in every corner." },
      { text: "a judge picked which ones actually felt like me. then it cut the final pieces." },
    ],
    judge: () => [
      { text: "persona alignment is 30% of the score. the question is basically: does this feel made for them.", attach: { kind: "judge" } },
      { text: "uniqueness counts too. if a stock generator could've made it, it loses points. i like that." },
    ],
    make: () => [
      { text: "svg icons, images and textures, short ambient loops, tokens, a manifest saying why each thing exists." },
      { text: "the loops are my favourite. little vhs moments.", attach: { kind: "link", href: "/method/#deliverables", label: "see the files" } },
    ],
    own: () => [
      { text: "you should. bring something specific. a dead link you miss, a room you can't forget." },
      { text: "or remix one of us. moss and vhs tape could be beautiful.", attach: { kind: "link", href: "/gui?new=1", label: "measure your own" } },
    ],
    others: () => [
      { text: "moss grows things. ren runs a market in their head. we don't agree on much." },
      { text: "they're up there. say hi." },
    ],
    thanks: () => [{ text: "...bye for now." }],
    unknown: (c) => [
      { text: "i don't know... the signal's a bit fuzzy on that one." },
      { text: `try asking about my colours, the ${c.heading} type, or how baste made me.` },
    ],
  },
};

const VOICES: Record<string, Voice> = { cyberbotanist: MOSS, nightmarketcoder: REN, liminalweeb: ADA };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function voiceOf(id: string): Pick<Voice, "handle" | "status"> {
  const v = VOICES[id] ?? MOSS;
  return { handle: v.handle, status: v.status };
}

function ctx(p: PersonaRecord, t: DesignTokens, seen: number): Ctx {
  return { p, t, seen, heading: primaryFamily(t.typography.fontFamily.heading), body: primaryFamily(t.typography.fontFamily.body) };
}

export function greet(p: PersonaRecord, t: DesignTokens): Bubble[] {
  return (VOICES[p.id] ?? MOSS).greet(ctx(p, t, 0));
}

/** Answer locally, in voice. `covered` counts how often each topic has come up. */
export function respond(p: PersonaRecord, t: DesignTokens, text: string, covered: Topic[]): Reply {
  const voice = VOICES[p.id] ?? MOSS;
  let topic = classify(text);
  if (topic === "hello") topic = covered.includes("who") ? "unknown" : "who";
  const seen = covered.filter((c) => c === topic).length;
  return { topic, bubbles: voice.lines[topic](ctx(p, t, seen)) };
}

/** A person-like beat before each message: reading, then typing roughly in time with the length. */
export function typingDelay(text: string, first: boolean): number {
  const typing = Math.min(2200, 380 + text.length * 18);
  return first ? 500 + typing : 280 + typing * 0.7;
}
