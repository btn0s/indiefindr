import { GameFacets } from '../ai/facet-extractor';
import { WebGroundedFacet } from "../ai/perplexity";
import { SteamStoreData } from '../steam/providers';

export interface FacetDocs {
  aesthetic: string;
  gameplay: string;
  narrative: string;
}

/**
 * Generic Steam platform tags that don't contribute to semantic similarity
 * These are technical/metadata tags that many games share
 */
const GENERIC_STEAM_TAGS = new Set([
  'Steam Achievements',
  'Steam Cloud',
  'Steam Trading Cards',
  'Steam Workshop',
  'Steam Leaderboards',
  'Family Sharing',
  'Save Anytime',
  'Subtitle Options',
  'Adjustable Text Size',
  'Adjustable Difficulty',
  'Camera Comfort',
  'Playable without Timed Input',
  'Remote Play on Tablet',
  'Remote Play on Phone',
  'Remote Play on TV',
  'Partial Controller Support',
  'Full controller support',
  'Includes level editor',
  'In-App Purchases',
  'Stats',
  'Cross-Platform Multiplayer',
  'Online Co-op',
  'LAN Co-op',
  'Online PvP',
  'Local PvP',
  'Single-player',
  'Multi-player',
  'Co-op',
  'PvP',
]);

const BUCKET_KEYWORDS = {
  aesthetic: [
    'pixel', 'low poly', 'cel', 'hand-drawn', 'voxel', '2d', '3d', 'retro',
    'anime', 'manga', 'comic', 'noir', 'horror', 'fantasy', 'sci-fi',
    'cyber', 'steampunk', 'dieselpunk', 'post-apocalyptic', 'minimalist',
    'cozy', 'colorful', 'stylized', 'photorealistic', 'isometric'
  ],
  gameplay: [
    'rogue', 'roguelike', 'roguelite', 'deckbuilder', 'card', 'shooter',
    'fps', 'third-person', 'tps', 'metroidvania', 'platformer', 'soulslike',
    'extraction', 'co-op', 'multiplayer', 'pvp', 'battle royale',
    'survival', 'strategy', 'rts', '4x', 'tactics', 'turn-based',
    'puzzle', 'stealth', 'simulation', 'sim', 'city', 'builder',
    'management', 'craft', 'sandbox', 'open world', 'rpg', 'jrpg',
    'arpg', 'moba', 'fighting', 'racer', 'sports', 'rhythm'
  ],
  narrative: [
    'story rich', 'visual novel', 'narrative', 'horror', 'mystery',
    'thriller', 'noir', 'choices matter', 'choice', 'multiple endings',
    'branching', 'detective', 'romance', 'dating', 'dialogue', 'episodic',
    'character-driven'
  ],
  meta: [
    'co-op', 'multiplayer', 'pvp', 'online', 'cross-platform', 'controller',
    'vr', 'early access', 'mod', 'workshop', 'competitive'
  ],
} as const;

/**
 * Filter out generic Steam tags, keeping only meaningful game-related tags
 */
function filterMeaningfulTags(tags: string[]): string[] {
  return tags.filter(
    (tag) => !GENERIC_STEAM_TAGS.has(tag) && tag.length > 2
  );
}

type TagBuckets = {
  aesthetic: string[];
  gameplay: string[];
  narrative: string[];
  meta: string[];
};

/**
 * Roughly bucket tags into facets to keep embeddings focused
 */
function bucketTags(tags: string[]): TagBuckets {
  const buckets: TagBuckets = {
    aesthetic: [],
    gameplay: [],
    narrative: [],
    meta: [],
  };

  const seen = {
    aesthetic: new Set<string>(),
    gameplay: new Set<string>(),
    narrative: new Set<string>(),
    meta: new Set<string>(),
  };

  tags.forEach((tag) => {
    const lower = tag.toLowerCase();
    (Object.keys(BUCKET_KEYWORDS) as Array<keyof typeof BUCKET_KEYWORDS>).forEach((bucket) => {
      const match = BUCKET_KEYWORDS[bucket].some((keyword) =>
        lower.includes(keyword)
      );
      if (match && !seen[bucket].has(tag)) {
        seen[bucket].add(tag);
        buckets[bucket].push(tag);
      }
    });
  });

  return buckets;
}

/**
 * Build facet text documents from web-grounded Perplexity searches.
 *
 * Strategy:
 * - Use Perplexity web search results (refined to descriptor words) for all facets
 * - Fall back to vision model output if Perplexity returns null
 * - Ignore Steam tags (they're generic and don't capture community language well)
 *
 * @param gameData - Store data from Steam API (description, screenshots, etc) - kept for compatibility but not used
 * @param communityTags - Community tags from steam-user - kept for compatibility but not used
 * @param visionFacets - Facets extracted by vision model (used as fallback)
 * @param webFacets - Web-grounded facet descriptions from Perplexity (refined descriptor words)
 */
export function buildFacetDocs(
  gameData: SteamStoreData,
  communityTags: Record<string, number>,
  visionFacets: GameFacets,
  webFacets?: {
    aesthetic?: WebGroundedFacet | null;
    gameplay?: WebGroundedFacet | null;
    narrative?: WebGroundedFacet | null;
  }
): FacetDocs {
  console.log("\n[BUILD_FACETS] Building facet documents");
  console.log("[BUILD_FACETS] Web aesthetic:", webFacets?.aesthetic?.description || "null");
  console.log("[BUILD_FACETS] Web gameplay:", webFacets?.gameplay?.description || "null");
  console.log("[BUILD_FACETS] Web narrative:", webFacets?.narrative?.description || "null");

  // Extract vision descriptions as fallback
  const visionAestheticDesc =
    !visionFacets.aesthetics
      ? ""
      : typeof visionFacets.aesthetics === "string"
      ? visionFacets.aesthetics
      : visionFacets.aesthetics.description || "";

  const visionGameplayDesc =
    !visionFacets.gameplay
      ? ""
      : typeof visionFacets.gameplay === "string"
      ? visionFacets.gameplay
      : visionFacets.gameplay.description || "";

  const visionNarrativeDesc =
    !visionFacets.narrativeMood
      ? ""
      : typeof visionFacets.narrativeMood === "string"
      ? visionFacets.narrativeMood
      : visionFacets.narrativeMood.description || "";

  // Prioritize Perplexity results (community language), fall back to vision
  const result = {
    aesthetic: webFacets?.aesthetic?.description || visionAestheticDesc || "",
    gameplay: webFacets?.gameplay?.description || visionGameplayDesc || "",
    narrative: webFacets?.narrative?.description || visionNarrativeDesc || "",
  };

  console.log("[BUILD_FACETS] Final aesthetic doc:\n", result.aesthetic);
  console.log("[BUILD_FACETS] Final gameplay doc:\n", result.gameplay);
  console.log("[BUILD_FACETS] Final narrative doc:\n", result.narrative);

  return result;
}
