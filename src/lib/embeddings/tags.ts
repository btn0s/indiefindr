/**
 * Tag normalization and categorization for game embeddings
 *
 * Maps Steam tags to canonical forms and categorizes them
 * for use in MECHANICS and other text-based facets.
 */

// =============================================================================
// TAG SYNONYMS - Map variations to canonical forms
// =============================================================================

export const TAG_SYNONYMS: Record<string, string> = {
  // Subgenre normalization
  "Souls-like": "soulslike",
  Soulslike: "soulslike",
  Soulsborne: "soulslike",
  "Rogue-like": "roguelike",
  Roguelite: "roguelike",
  "Rogue-lite": "roguelike",
  Roguelike: "roguelike",
  Metroidvania: "metroidvania",
  MetroidVania: "metroidvania",
  "Metroid-vania": "metroidvania",

  // Perspective normalization
  "First-Person": "first-person",
  "First Person": "first-person",
  FPS: "first-person-shooter",
  "Third-Person": "third-person",
  "Third Person": "third-person",
  "Top-Down": "top-down",
  "Top Down": "top-down",
  Isometric: "isometric",
  "Side-Scroller": "side-scroller",
  "Side Scroller": "side-scroller",
  Sidescroller: "side-scroller",
  "2D Platformer": "platformer-2d",
  "3D Platformer": "platformer-3d",

  // Genre normalization
  "Action RPG": "action-rpg",
  ARPG: "action-rpg",
  "Turn-Based": "turn-based",
  "Turn Based": "turn-based",
  "Real-Time": "real-time",
  "Real Time": "real-time",
  RTS: "real-time-strategy",
  "Real-Time Strategy": "real-time-strategy",
  "Real Time Strategy": "real-time-strategy",

  // Mode normalization
  "Single-player": "singleplayer",
  "Single Player": "singleplayer",
  Singleplayer: "singleplayer",
  "Multi-player": "multiplayer",
  "Multi Player": "multiplayer",
  Multiplayer: "multiplayer",
  "Co-op": "coop",
  "Co-Op": "coop",
  Coop: "coop",
  Cooperative: "coop",
  PvP: "pvp",
  PVP: "pvp",
  "Player vs Player": "pvp",
  PvE: "pve",
  PVE: "pve",
  "Player vs Environment": "pve",
};

// =============================================================================
// TAG CATEGORIES - Group tags by type
// =============================================================================

export const MECHANIC_TAGS = new Set([
  // Core mechanics
  "roguelike",
  "metroidvania",
  "soulslike",
  "bullet-hell",
  "hack-and-slash",
  "beat-em-up",
  "shoot-em-up",
  "run-and-gun",

  // Gameplay systems
  "crafting",
  "base-building",
  "city-builder",
  "management",
  "simulation",
  "survival",
  "stealth",
  "tower-defense",
  "deck-building",
  "card-game",

  // Combat styles
  "turn-based",
  "real-time",
  "tactical",
  "strategy",
  "action",
  "combat",

  // Progression systems
  "rpg",
  "action-rpg",
  "jrpg",
  "crpg",
  "skill-tree",
  "leveling",
  "loot",

  // Movement/traversal
  "platformer",
  "platformer-2d",
  "platformer-3d",
  "parkour",
  "racing",
  "driving",
  "flying",

  // Puzzle
  "puzzle",
  "puzzle-platformer",
  "logic",
  "mystery",

  // Exploration
  "exploration",
  "open-world",
  "sandbox",
  "walking-simulator",
  "adventure",
]);

export const PERSPECTIVE_TAGS = new Set([
  "first-person",
  "first-person-shooter",
  "third-person",
  "top-down",
  "isometric",
  "side-scroller",
  "2d",
  "3d",
  "vr",
  "bird-view",
  "point-and-click",
]);

export const MODE_TAGS = new Set([
  "singleplayer",
  "multiplayer",
  "coop",
  "pvp",
  "pve",
  "local-coop",
  "online-coop",
  "split-screen",
  "mmo",
  "massively-multiplayer",
]);

export const MOOD_TAGS = new Set([
  // Positive/Cozy
  "cozy",
  "relaxing",
  "peaceful",
  "wholesome",
  "cute",
  "casual",
  "family-friendly",

  // Dark/Tense
  "dark",
  "atmospheric",
  "horror",
  "psychological-horror",
  "survival-horror",
  "creepy",
  "disturbing",
  "gore",
  "violent",

  // Whimsical
  "colorful",
  "surreal",
  "quirky",
  "funny",
  "comedy",
  "parody",
  "absurd",

  // Melancholic
  "emotional",
  "story-rich",
  "narrative",
  "choices-matter",
  "multiple-endings",

  // Action
  "fast-paced",
  "action-packed",
  "intense",
  "adrenaline",
]);

export const THEME_TAGS = new Set([
  // Settings
  "sci-fi",
  "fantasy",
  "medieval",
  "post-apocalyptic",
  "cyberpunk",
  "steampunk",
  "space",
  "western",
  "noir",
  "modern",
  "historical",
  "world-war",
  "alternate-history",

  // Supernatural
  "magic",
  "supernatural",
  "lovecraftian",
  "mythology",
  "demons",
  "vampires",
  "zombies",

  // Nature
  "nature",
  "animals",
  "farming",
  "fishing",

  // Abstract
  "abstract",
  "minimalist",
  "experimental",
]);

export const VISUAL_STYLE_TAGS = new Set([
  "pixel-art",
  "retro",
  "8-bit",
  "16-bit",
  "hand-drawn",
  "stylized",
  "anime",
  "cartoon",
  "realistic",
  "photorealistic",
  "low-poly",
  "voxel",
  "cel-shaded",
  "noir",
  "black-and-white",
  "colorful",
  "minimalist",
  "beautiful",
  "great-soundtrack",
]);

// =============================================================================
// NORMALIZATION FUNCTIONS
// =============================================================================

/**
 * Normalize a single tag to its canonical form
 */
export function normalizeTag(tag: string): string {
  // Check for exact synonym match first
  if (TAG_SYNONYMS[tag]) {
    return TAG_SYNONYMS[tag];
  }

  // Convert to lowercase and replace spaces with hyphens
  return tag.toLowerCase().replace(/\s+/g, "-");
}

/**
 * Normalize an array of tags
 */
export function normalizeTags(tags: string[]): string[] {
  return tags.map(normalizeTag);
}

/**
 * Categorize tags by type
 */
export function categorizeTags(tags: string[]): {
  mechanics: string[];
  perspectives: string[];
  modes: string[];
  moods: string[];
  themes: string[];
  visuals: string[];
  other: string[];
} {
  const normalized = normalizeTags(tags);

  const result = {
    mechanics: [] as string[],
    perspectives: [] as string[],
    modes: [] as string[],
    moods: [] as string[],
    themes: [] as string[],
    visuals: [] as string[],
    other: [] as string[],
  };

  for (const tag of normalized) {
    if (MECHANIC_TAGS.has(tag)) {
      result.mechanics.push(tag);
    } else if (PERSPECTIVE_TAGS.has(tag)) {
      result.perspectives.push(tag);
    } else if (MODE_TAGS.has(tag)) {
      result.modes.push(tag);
    } else if (MOOD_TAGS.has(tag)) {
      result.moods.push(tag);
    } else if (THEME_TAGS.has(tag)) {
      result.themes.push(tag);
    } else if (VISUAL_STYLE_TAGS.has(tag)) {
      result.visuals.push(tag);
    } else {
      result.other.push(tag);
    }
  }

  return result;
}

/**
 * Extract tags from Steam's steamspy_tags format
 * Returns tags sorted by weight (most common first)
 */
export function extractSortedTags(
  steamsbyTags: Record<string, number> | null | undefined
): string[] {
  if (!steamsbyTags) {
    return [];
  }

  return Object.entries(steamsbyTags)
    .sort(([, a], [, b]) => b - a)
    .map(([tag]) => tag);
}

/**
 * Get the top N tags by weight
 */
export function getTopTags(
  steamsbyTags: Record<string, number> | null | undefined,
  n: number = 10
): string[] {
  return extractSortedTags(steamsbyTags).slice(0, n);
}

// =============================================================================
// INFERENCE FUNCTIONS
// =============================================================================

/**
 * Infer game perspective from tags
 */
export function inferPerspective(tags: string[]): string {
  const normalized = normalizeTags(tags);

  const perspectiveOrder = [
    "first-person",
    "third-person",
    "top-down",
    "isometric",
    "side-scroller",
    "2d",
    "3d",
  ];

  for (const perspective of perspectiveOrder) {
    if (normalized.includes(perspective)) {
      return perspective;
    }
  }

  // Infer from genre tags
  if (normalized.some((t) => t.includes("fps") || t.includes("shooter"))) {
    return "first-person";
  }

  if (normalized.some((t) => t.includes("platformer"))) {
    if (normalized.includes("3d")) {
      return "third-person";
    }
    return "side-scroller";
  }

  return "unknown";
}

/**
 * Infer game modes from tags
 */
export function inferGameModes(tags: string[]): string[] {
  const normalized = normalizeTags(tags);
  const modes: string[] = [];

  if (
    normalized.includes("singleplayer") ||
    normalized.includes("single-player")
  ) {
    modes.push("Single-player");
  }

  if (normalized.includes("multiplayer") || normalized.includes("online")) {
    modes.push("Multiplayer");
  }

  if (
    normalized.includes("coop") ||
    normalized.includes("co-op") ||
    normalized.includes("cooperative")
  ) {
    modes.push("Co-op");
  }

  if (normalized.includes("pvp") || normalized.includes("competitive")) {
    modes.push("PvP");
  }

  if (normalized.includes("local-coop") || normalized.includes("split-screen")) {
    modes.push("Local Co-op");
  }

  // Default to single-player if nothing detected
  if (modes.length === 0) {
    modes.push("Single-player");
  }

  return modes;
}

/**
 * Infer primary subgenre from tags
 */
export function inferSubgenre(tags: string[]): string {
  const normalized = normalizeTags(tags);

  // Check for specific subgenres in priority order
  const subgenreOrder = [
    "metroidvania",
    "soulslike",
    "roguelike",
    "bullet-hell",
    "deck-building",
    "city-builder",
    "survival",
    "tower-defense",
    "walking-simulator",
    "visual-novel",
  ];

  for (const subgenre of subgenreOrder) {
    if (normalized.includes(subgenre)) {
      return subgenre;
    }
  }

  // Fall back to genre combination
  const hasAction = normalized.includes("action");
  const hasRPG =
    normalized.includes("rpg") || normalized.includes("role-playing");
  const hasPlatformer = normalized.includes("platformer");
  const hasPuzzle = normalized.includes("puzzle");
  const hasStrategy = normalized.includes("strategy");
  const hasSimulation = normalized.includes("simulation");

  if (hasAction && hasRPG) return "action-rpg";
  if (hasPlatformer && hasPuzzle) return "puzzle-platformer";
  if (hasAction && hasPlatformer) return "action-platformer";
  if (hasStrategy && normalized.includes("turn-based")) return "turn-based-strategy";
  if (hasStrategy && normalized.includes("real-time")) return "real-time-strategy";
  if (hasSimulation) return "simulation";

  return normalized[0] || "indie";
}
