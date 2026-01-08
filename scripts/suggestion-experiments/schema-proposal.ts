/*
PROPOSED SCHEMA CHANGES
=======================

1. Add SteamSpy data to games_new table
2. Restructure suggestions with categories

MIGRATION:
*/

const MIGRATION_SQL = `
-- Add SteamSpy enrichment columns to games_new
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_tags JSONB DEFAULT '{}';
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_owners TEXT;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_positive INTEGER;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_negative INTEGER;
ALTER TABLE games_new ADD COLUMN IF NOT EXISTS steamspy_updated_at TIMESTAMPTZ;

-- New structured suggestions format
-- Instead of: suggested_game_appids JSONB (flat array)
-- We want:    suggestions JSONB (categorized object)

COMMENT ON COLUMN games_new.steamspy_tags IS 'User tags from SteamSpy: {"Horror": 500, "Indie": 400, ...}';
COMMENT ON COLUMN games_new.steamspy_owners IS 'Owner range string: "100,000 .. 200,000"';
`;

/*
NEW SUGGESTIONS STRUCTURE:
*/

type CategorizedSuggestions = {
  sameDeveloper: Suggestion[];  // Always shown first, gold standard
  niche: Suggestion[];          // < 200k owners, indie gems
  classics: Suggestion[];       // > 500k owners, established games  
  upcoming: Suggestion[];       // Not yet released (coming_soon = true)
  
  metadata: {
    generatedAt: string;
    sourceAppid: number;
    sourceTags: string[];
  };
};

type Suggestion = {
  appId: number;
  title: string;
  explanation: string;
  
  // Enrichment data (from SteamSpy at generation time)
  tags: string[];           // Top 5 tags
  owners: string;           // "100,000 .. 200,000"
  score: number;            // Tag overlap score 0-1
  sharedTags: string[];     // Tags in common with source
  releaseDate?: string;     // For upcoming filter
  isIndie: boolean;
};

/*
CATEGORY LOGIC:
*/

function categorizeSuggestion(
  suggestion: Suggestion,
  sourceDeveloper: string
): "sameDeveloper" | "niche" | "classics" | "upcoming" {
  // Check if same developer
  // (would need to fetch/store developer for each suggestion)
  
  // Check if upcoming
  if (suggestion.releaseDate) {
    const releaseDate = new Date(suggestion.releaseDate);
    if (releaseDate > new Date()) {
      return "upcoming";
    }
  }
  
  // Check owner count
  const ownerCount = parseOwnerCount(suggestion.owners);
  
  if (ownerCount < 200_000) {
    return "niche";
  }
  
  return "classics";
}

function parseOwnerCount(owners: string): number {
  const match = owners.match(/^([\d,]+)/);
  if (!match) return 0;
  return parseInt(match[1].replace(/,/g, ""), 10);
}

/*
UI TABS:
- "From the Developer" (if any same-dev games exist)
- "Hidden Gems" (niche)
- "Classics" (established)
- "Coming Soon" (upcoming)

BENEFITS:
1. User can browse by preference (discovery vs familiar)
2. We can show MORE suggestions without overwhelming
3. Niche filter doesn't hide good popular games
4. Same-dev games get premium placement
5. Upcoming games drive wishlist behavior
*/

console.log("Schema proposal - see comments in file");
console.log("\nMigration SQL:");
console.log(MIGRATION_SQL);
