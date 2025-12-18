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
 * Build facet text documents from vision output and lightly bucketed Steam tags.
 *
 * Strategy: keep the vision descriptions as the core signal, then append
 * bucketed tags per facet (aesthetic/gameplay/narrative) plus meta tags so the
 * embedding encodes exact industry terms without over-weighting generic tags.
 */
export function buildFacetDocs(
  gameData: NormalizedGameData,
  visionFacets: GameFacets
): FacetDocs {
  const meaningfulTags = filterMeaningfulTags([
    ...gameData.genres,
    ...gameData.tags,
  ]);
  const buckets = bucketTags(meaningfulTags);

  const summarize = (label: string, values: string[]) =>
    values.length > 0 ? `${label}: ${values.slice(0, 8).join(', ')}` : '';

  const aestheticTags = summarize('Aesthetic tags', buckets.aesthetic);
  const gameplayTags = summarize('Gameplay tags', buckets.gameplay);
  const narrativeTags = summarize('Narrative tags', buckets.narrative);
  const metaTags = summarize('Meta tags', buckets.meta);

  return {
    aesthetic: typeof visionFacets.aesthetics === 'string' 
      ? visionFacets.aesthetics 
      : [
          visionFacets.aesthetics.description,
          aestheticTags,
          metaTags,
        ].filter(Boolean).join('\n\n'),
    gameplay: typeof visionFacets.gameplay === 'string'
      ? visionFacets.gameplay
      : [
          visionFacets.gameplay.description,
          gameplayTags,
          metaTags,
        ].filter(Boolean).join('\n\n'),
    narrative: typeof visionFacets.narrativeMood === 'string'
      ? visionFacets.narrativeMood
      : [
          visionFacets.narrativeMood.description,
          narrativeTags,
          metaTags,
        ].filter(Boolean).join('\n\n'),
  };
}
