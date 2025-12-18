import { GameFacets } from '../ai/facet-extractor';
import { NormalizedGameData } from '../steam/providers/steamStoreProvider';

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

/**
 * Filter out generic Steam tags, keeping only meaningful game-related tags
 */
function filterMeaningfulTags(tags: string[]): string[] {
  return tags.filter(
    (tag) => !GENERIC_STEAM_TAGS.has(tag) && tag.length > 2
  );
}

/**
 * Build facet text documents from vision output and game metadata
 * 
 * Strategy: For embeddings, use ONLY the vision model output. The vision model
 * already captures semantic meaning from screenshots. Appending genres/tags
 * dilutes the semantic signal and causes false matches between dissimilar games.
 * 
 * Genres/tags are stored separately in the database for filtering/keyword search,
 * but should not be embedded as they create noise in semantic similarity.
 * 
 * For embeddings: Pure vision output (100-300 words) provides the best semantic
 * precision. The vision model generates focused descriptions that capture what
 * makes each game unique.
 */
export function buildFacetDocs(
  gameData: NormalizedGameData,
  visionFacets: GameFacets
): FacetDocs {
  // Extract descriptions from the structured facet objects
  // For embeddings, use the description which combines keywords into coherent text
  // Keywords are stored separately for filtering/search but not embedded
  return {
    aesthetic: typeof visionFacets.aesthetics === 'string' 
      ? visionFacets.aesthetics 
      : visionFacets.aesthetics.description,
    gameplay: typeof visionFacets.gameplay === 'string'
      ? visionFacets.gameplay
      : visionFacets.gameplay.description,
    narrative: typeof visionFacets.narrativeMood === 'string'
      ? visionFacets.narrativeMood
      : visionFacets.narrativeMood.description,
  };
}
