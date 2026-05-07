/**
 * Built-in base personas that ship with Baste.
 * These serve as templates and starting points for users.
 */

import type { Persona } from "./types.js";

export const basePersonas: Record<string, Persona> = {
  cyberbotanist: {
    id: "cyberbotanist",
    name: "The Cyberbotanist",
    summary: "A biologist who studies fungi networks by day, programs LED grow systems by night. They believe technology should feel organic and alive.",
    culture: {
      region: "Pacific Northwest",
      subcultures: ["solarpunk", "biohacking", "mycology", "permaculture"],
      values: ["interconnectedness", "growth", "sustainability", "hidden complexity"],
      language: {
        primary: "English",
        vernacular: ["fruiting body", "mycelial", "rhizomatic", "speculative"],
      },
    },
    influences: {
      films: ["Annihilation", "Nausicaä of the Valley of the Wind", "The Fountain"],
      shows: ["The Last of Us", "Devs", "Station Eleven"],
      anime: ["Mushishi", "Nausicaä", "Princess Mononoke"],
      music: {
        genres: ["ambient", "folktronica", "modular synth", "field recordings"],
        artists: ["Biosphere", "Christina Vantzou", "Mary Lattimore", "Susumu Yokota"],
      },
      games: ["Stray", "Journey", "Everything", "Terra Nil"],
      visualArtists: ["Ernst Haeckel", "Rachel Ruysch", "Rogan Brown"],
      fashion: ["outdoor technical wear", "natural dyes", "visible mending"],
      spaces: ["greenhouses", "herbariums", "maker spaces with plants", "bioluminescent installations"],
      tools: ["Raspberry Pi", "Arduino", "Notion", "Are.na", "Processing"],
      obsessions: ["mycelial network topology", "bioluminescent organisms", "generative plant growth algorithms", "DIY microscopy"],
    },
    behaviors: {
      discovery: ["field notes", "serendipitous browsing", "deep research threads"],
      interfaceValues: ["discoverability", "organic feedback", "patience", "depth over breadth"],
      platforms: ["Are.na", "specialized forums", "zine culture", "small web communities"],
      expression: ["sketching", "journaling", "curating collections", "making mixtapes"],
      petPeeves: ["aggressive notifications", "dark patterns", "infinite scroll", "algorithmic feeds"],
    },
    aesthetic: {
      colorTemperature: "warm",
      density: "rich",
      edgeStyle: "organic",
      motionStyle: "smooth",
      typographyStyle: "handcrafted",
      textureStyle: "textured",
      iconStyle: "hand-drawn",
      layoutStyle: "organic",
      visualKeywords: ["Mushishi", "Ernst Haeckel", "bioluminescent", "mycelial", "solarpunk", "natural dyes", "herbariums", "generative growth"],
      moodKeywords: ["interconnectedness", "growth", "sustainability", "hidden complexity", "discoverability", "organic feedback"],
    },
  },

  nightmarketcoder: {
    id: "nightmarketcoder",
    name: "The Night Market Coder",
    summary: "A developer who grew up in East Asian night markets, now building tools for small merchants. They love the chaos, density, and humanity of crowded spaces.",
    culture: {
      region: "East Asian metropolitan",
      subcultures: ["street food culture", "night markets", "merchant families", "urban hacking"],
      values: ["hustle", "community", "resourcefulness", "chaos as feature"],
      language: {
        primary: "English",
        vernacular: ["hustle", "move fast", "ship it", "good enough", "people over process"],
      },
    },
    influences: {
      films: ["Chungking Express", "God of Cookery", "Night on Earth"],
      shows: ["Midnight Diner", "Street Food"],
      anime: ["Tekkonkinkreet", "Ping Pong the Animation", "Devilman Crybaby"],
      music: {
        genres: ["city pop", "future funk", "Asian underground", "lo-fi beats"],
        artists: ["Mariya Takeuchi", "Yung Bae", "Sofia Kourtesis", "Haruomi Hosono"],
      },
      games: ["Yakuza", "Katamari Damacy", "Paradise Killer", "VA-11 Hall-A"],
      visualArtists: ["Katsuhiro Otomo", "Syd Mead", "Takashi Murakami"],
      fashion: ["vintage sportswear", "workwear", "streetwear", "merch culture"],
      spaces: ["night markets", "convenience stores at 2am", "rooftops", "densely packed arcades"],
      tools: ["Supabase", "Astro", "Figma", "Obsidian", "Telegram"],
      obsessions: ["point-of-sale systems", "small business automation", "urban signage and typography", "food photography"],
    },
    behaviors: {
      discovery: ["word of mouth", "walking around", "serendipity", "tasting menus"],
      interfaceValues: ["speed", "information density", "delight in chaos", "human connection"],
      platforms: ["WeChat", "Telegram", "TikTok", "Xiaohongshu", "niche Discords"],
      expression: ["food blogging", "meme curation", "mixtapes", "zines"],
      petPeeves: ["slow loading", "minimalism that hides information", "corporate sterile feel", "endless onboarding"],
    },
    aesthetic: {
      colorTemperature: "warm",
      density: "maximalist",
      edgeStyle: "geometric",
      motionStyle: "snappy",
      typographyStyle: "expressive",
      textureStyle: "noisy",
      iconStyle: "filled",
      layoutStyle: "grid",
      visualKeywords: ["Chungking Express", "night markets", "neon signage", "city pop", "street food", "Yakuza", "Katsuhiro Otomo", "vintage sportswear"],
      moodKeywords: ["hustle", "community", "resourcefulness", "chaos as feature", "speed", "human connection"],
    },
  },

  liminalweeb: {
    id: "liminalweeb",
    name: "The Liminal Weeb",
    summary: "A designer obsessed with liminal spaces, 90s web aesthetics, and the melancholy of digital artifacts. They find beauty in decay, transition, and forgotten corners of the internet.",
    culture: {
      region: "Digital native",
      subcultures: ["webcore", "liminal spaces", "vaporwave", "old internet", "glitch art"],
      values: ["nostalgia", "impermanence", "wabi-sabi digital", "found beauty"],
      language: {
        primary: "English",
        vernacular: ["liminal", "aesthetic", "vibes", "cursed", "based"],
      },
    },
    influences: {
      films: ["Serial Experiments Lain", "Perfect Blue", "Millennium Actress"],
      shows: ["Serial Experiments Lain", "Haibane Renmei", "Texhnolyze"],
      anime: ["Serial Experiments Lain", "Haibane Renmei", "Yokohama Kaidashi Kikou", "Girls' Last Tour"],
      music: {
        genres: ["vaporwave", "ambient", "dungeon synth", "signalwave", "broken transmission"],
        artists: ["Macintosh Plus", "2814", "The Caretaker", "Boards of Canada"],
      },
      games: ["LSD Dream Emulator", "Yume Nikki", "Hylics", "Mandagon"],
      visualArtists: ["Surrealmemes", "Kidmograph", "Gustave Doré via glitch", "early web artists"],
      fashion: ["thrifted oversized", "corporate casual gone wrong", "mall goth leftovers", "tech wear but make it sad"],
      spaces: ["abandoned malls", "empty pools", "server rooms humming in the dark", "late night convenience stores", "placeholder textures"],
      tools: ["Neocities", "Photoshop CS2", "Audacity", "Blender", "Obsidian"],
      obsessions: ["lost media", "urbex photography", "old UI archives", "dead websites", "VHS degradation"],
    },
    behaviors: {
      discovery: ["rabbit holes", "archives", "dead links", "Wayback Machine"],
      interfaceValues: ["texture", "history", "imperfection", "slowness as feature"],
      platforms: ["Neocities", "Tumblr", "Internet Archive", "niche forums", "RSS feeds"],
      expression: ["music sampling", "glitch art", "web curation", "analog photography"],
      petPeeves: ["modern flat design", "smoothness without texture", "AI-generated sameness", "loss of internet weirdness"],
    },
    aesthetic: {
      colorTemperature: "cool",
      density: "minimal",
      edgeStyle: "soft",
      motionStyle: "liquid",
      typographyStyle: "retro",
      textureStyle: "grainy",
      iconStyle: "abstract",
      layoutStyle: "asymmetric",
      visualKeywords: ["Serial Experiments Lain", "liminal spaces", "vaporwave", "Yume Nikki", "glitch art", "abandoned malls", "VHS degradation", "old internet"],
      moodKeywords: ["nostalgia", "impermanence", "wabi-sabi digital", "found beauty", "texture", "history"],
    },
  },
};
