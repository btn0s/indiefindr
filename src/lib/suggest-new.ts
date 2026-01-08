import { generateText } from "ai";
import { getSupabaseServerClient } from "./supabase/server";
import { Suggestion } from "./supabase/types";

// ============================================================================
// TYPES
// ============================================================================

export type GameType = "mainstream" | "avant-garde" | "cozy" | "competitive" | "narrative" | "action";

export type GameProfile = {
  type: GameType;
  typeConfidence: number;
  vibe: string[];
  isKnownArtDev: boolean;
};

export type VibeResult = {
  suggestions: Suggestion[];
  timing: {
    profiling: number;
    strategies: number;
    validation: number;
    curation: number;
    total: number;
  };
  stats: {
    gameType: GameType;
    fromDb: number;
    fromSteam: number;
    unverified: number;
    totalUnique: number;
    highConsensus: number;
  };
};

type RawSuggestion = {
  title: string;
  reason: string;
};

type ValidatedSuggestion = RawSuggestion & {
  appid?: number;
  source: "db" | "steam" | "unverified";
};

// ============================================================================
// KNOWN ART-GAME DEVELOPERS
// ============================================================================

const KNOWN_ARTGAME_DEVS = [
  "the water museum",
  "thecatamites",
  "tale of tales",
  "ice water games",
  "kittyhorrorshow",
  "increpare",
  "molleindustria",
  "stephen lavelle",
  "nathalie lawhead",
  "porpentine",
  "connor sherlock",
  "cactus",
  "messhof",
  "droqen",
  "jonatan söderström",
  "david o'reilly",
  "cosmo d",
  "cardboard computer",
  "variable state",
  "annapurna interactive", // publisher but often art games
  "lmb",
  "sokpop collective",
  "virtanen",
];

// ============================================================================
// TYPE-SPECIFIC WEIGHTS
// ============================================================================

type Weights = {
  vibe: number;
  aesthetic: number;
  theme: number;
  mechanics: number;
};

function getWeightsForType(type: GameType): Weights {
  switch (type) {
    case "avant-garde":
      return { vibe: 0.45, aesthetic: 0.30, theme: 0.20, mechanics: 0.05 };
    case "cozy":
      return { vibe: 0.40, aesthetic: 0.35, theme: 0.15, mechanics: 0.10 };
    case "competitive":
      return { vibe: 0.15, aesthetic: 0.10, theme: 0.10, mechanics: 0.65 };
    case "narrative":
      return { vibe: 0.30, aesthetic: 0.20, theme: 0.35, mechanics: 0.15 };
    case "action":
      // Action games need BOTH tone AND mechanics to match
      return { vibe: 0.30, aesthetic: 0.15, theme: 0.15, mechanics: 0.40 };
    case "mainstream":
    default:
      return { vibe: 0.30, aesthetic: 0.25, theme: 0.20, mechanics: 0.25 };
  }
}

// ============================================================================
// GAME TYPE DETECTION
// ============================================================================

function checkKnownArtDev(developers: string[]): boolean {
  const devLower = developers.map((d) => d.toLowerCase());
  return KNOWN_ARTGAME_DEVS.some((artDev) =>
    devLower.some((d) => d.includes(artDev) || artDev.includes(d))
  );
}

async function detectGameType(
  title: string,
  description: string,
  developers: string[]
): Promise<GameProfile> {
  const isKnownArtDev = checkKnownArtDev(developers);

  // Fast path: known art-game developers
  if (isKnownArtDev) {
    return {
      type: "avant-garde",
      typeConfidence: 0.95,
      vibe: ["experimental", "artistic", "unconventional"],
      isKnownArtDev: true,
    };
  }

  // AI classification for unknown developers
  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt: `Read this game description carefully and identify its EMOTIONAL TONE and VIBE.

Game: ${title}
Developer: ${developers.join(", ") || "Unknown"}
Description: ${description}

IMPORTANT: Read the TONE of the writing, not just keywords.
- "gigantic crustacean festooned with cannons" = WHIMSICAL, QUIRKY, CHARMING (not "shooter")
- "harrowing descent into madness" = DARK, TENSE, PSYCHOLOGICAL
- "cozy cafe where you serve magical creatures" = WHOLESOME, RELAXING, COZY
- "brutal roguelike where death comes fast" = INTENSE, PUNISHING, ADRENALINE

Don't assume mechanics = vibe:
- "coop" doesn't mean chaotic (could be cozy coop like Stardew)
- "cannons" doesn't mean shooter (could be whimsical like pirates)
- "combat" doesn't mean intense (could be playful)

Types (pick ONE based on CORE GAMEPLAY, not story framing):
- action: Combat/shooter/fighting is the CORE loop. Keywords: guns, shooting, combat, fighting, tactical, battle. A game with story BUT guns-blazing gameplay = action, NOT narrative.
- narrative: Story IS the gameplay (visual novels, walking sims, dialogue RPGs). Combat-focused games with dark stories are still ACTION.
- cozy: Relaxation-focused, vibe/aesthetic critical
- competitive: Skill/challenge-focused (speedrun, esport, precision)
- avant-garde: Art/experimental, meaning over mechanics
- mainstream: Standard game that doesn't fit above categories

Extract 3-5 vibe words that capture the FEELING/TONE:
whimsical, quirky, charming, adventurous, imaginative, cozy, relaxing, tense, dark, melancholic, intense, frantic, chaotic, serene, meditative, playful, wholesome, mysterious, eerie, epic, silly, heartfelt, bittersweet, lonely, hopeful

Return JSON: {"type":"one_type","confidence":0.0-1.0,"vibe":["word1","word2","word3"]}
Return ONLY JSON.`,
    });

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        type: parsed.type as GameType,
        typeConfidence: parsed.confidence || 0.7,
        vibe: parsed.vibe || [],
        isKnownArtDev: false,
      };
    }
  } catch (err) {
    console.error("[SUGGEST] Game type detection failed:", err);
  }

  // Fallback to mainstream
  return {
    type: "mainstream",
    typeConfidence: 0.5,
    vibe: [],
    isKnownArtDev: false,
  };
}

// ============================================================================
// VALIDATION (DB & Steam search)
// ============================================================================

async function searchDb(
  title: string
): Promise<{ appid: number; title: string } | null> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("games_new")
    .select("appid, title")
    .ilike("title", `%${title}%`)
    .limit(1)
    .single();
  return data ? { appid: data.appid, title: data.title } : null;
}

async function searchSteam(
  query: string
): Promise<{ appid: number; name: string } | null> {
  try {
    const res = await fetch(
      `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(query)}`
    );
    const results = await res.json();
    return results?.[0]
      ? { appid: parseInt(results[0].appid), name: results[0].name }
      : null;
  } catch {
    return null;
  }
}

async function validateSuggestions(
  raw: RawSuggestion[]
): Promise<{ validated: ValidatedSuggestion[]; elapsed: number }> {
  const start = Date.now();

  const validated = await Promise.all(
    raw.map(async ({ title, reason }): Promise<ValidatedSuggestion> => {
      const cleanReason = reason.replace(/\[\d+\]/g, "").trim();

      const dbResult = await searchDb(title);
      if (dbResult) {
        return {
          title: dbResult.title,
          reason: cleanReason,
          appid: dbResult.appid,
          source: "db",
        };
      }

      const steamResult = await searchSteam(title);
      if (steamResult) {
        return {
          title: steamResult.name,
          reason: cleanReason,
          appid: steamResult.appid,
          source: "steam",
        };
      }

      return { title, reason: cleanReason, source: "unverified" };
    })
  );

  return { validated, elapsed: Date.now() - start };
}

// ============================================================================
// TYPE-SPECIFIC SUGGESTION STRATEGIES
// ============================================================================

async function runStrategyWithRetry(
  prompt: string,
  retries = 2
): Promise<{ raw: RawSuggestion[]; elapsed: number }> {
  const start = Date.now();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { text } = await generateText({
        model: "perplexity/sonar",
        prompt,
      });

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        return { raw: [], elapsed: Date.now() - start };
      }

      try {
        const parsed = JSON.parse(match[0]) as RawSuggestion[];
        return { raw: parsed, elapsed: Date.now() - start };
      } catch {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          continue;
        }
        return { raw: [], elapsed: Date.now() - start };
      }
    } catch {
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      return { raw: [], elapsed: Date.now() - start };
    }
  }

  return { raw: [], elapsed: Date.now() - start };
}

// Strategy 1: Vibe-focused (adapts based on game type)
function buildVibePrompt(
  profile: GameProfile,
  title: string,
  description: string,
  developers: string[],
  count: number
): string {
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";
  const vibeContext = profile.vibe.length > 0 ? ` Vibe: ${profile.vibe.join(", ")}.` : "";

  if (profile.type === "avant-garde") {
    return `Find ${count} EXPERIMENTAL/AVANT-GARDE indie games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is an ART GAME. Find games that:
- Are weird, surreal, experimental, unconventional
- Prioritize artistic expression or emotional experience over gameplay
- Come from the indie/art game scene
- Would appeal to players who like bizarre, thoughtful, boundary-pushing games

Do NOT suggest mainstream games. Only WEIRD/EXPERIMENTAL games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches the weird/experimental vibe"}]`;
  }

  if (profile.type === "cozy") {
    return `Find ${count} COZY/RELAXING indie games similar to "${title}"${devContext}.

Description: ${description}${vibeContext}

This is a COZY game. Find games that:
- Are relaxing, gentle, comforting
- Have similar calming aesthetics
- Match the peaceful, low-stress mood

Do NOT suggest stressful or intense games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it matches the cozy vibe"}]`;
  }

  // Default vibe prompt - focus on tone/feeling, not mechanics
  const vibeList = profile.vibe.length > 0 ? profile.vibe.join(", ") : "adventurous";
  
  return `Find ${count} indie games that FEEL like "${title}"${devContext}.

Description: ${description}

This game's vibe is: ${vibeList}

Find games with the SAME EMOTIONAL TONE - not just similar mechanics.
A whimsical sailing game should match OTHER whimsical adventure games, not generic shooters.
A cozy farming game should match OTHER cozy/relaxing games, not action games.

Match: atmosphere, tone, aesthetic, the FEELING of playing.
Focus on indie/small studio games. Avoid AAA titles.

Write SHORT reasons (under 15 words) about WHY it feels similar.
Return ONLY JSON: [{"title":"Game Name","reason":"Why it feels similar"}]`;
}

// Strategy 2: Mechanics-focused (adapts based on game type)
function buildMechanicsPrompt(
  profile: GameProfile,
  title: string,
  description: string,
  developers: string[],
  count: number
): string {
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";

  if (profile.type === "competitive") {
    return `Find ${count} games with SIMILAR GAMEPLAY MECHANICS to "${title}"${devContext}.

Description: ${description}

This is a SKILL-BASED game. Find games that:
- Have similar mechanical depth and challenge
- Match the core gameplay loop and systems
- Appeal to players who enjoy mastery and skill expression
- Have similar strategic/tactical depth

Focus on MECHANICAL SIMILARITY above all else.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why the gameplay matches"}]`;
  }

  if (profile.type === "avant-garde") {
    // For avant-garde, mechanics matter less - look for similar "interactive" styles
    return `Find ${count} games with similar INTERACTIVE EXPERIENCES to "${title}"${devContext}.

Description: ${description}

This is an experimental game. Find games with:
- Similar ways of interacting with the world
- Unconventional or minimalist mechanics
- Exploration or observation as core activities

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why the experience matches"}]`;
  }

  // Default mechanics prompt
  return `Find ${count} indie games with similar GAMEPLAY to "${title}"${devContext}.

Description: ${description}

Match core loop, interaction mechanics, control feel, gameplay systems.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why gameplay matches"}]`;
}

// Strategy 3: Community/similar-taste (adapts based on game type)
function buildCommunityPrompt(
  profile: GameProfile,
  title: string,
  description: string,
  developers: string[],
  count: number
): string {
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";

  if (profile.type === "avant-garde") {
    return `Find ${count} games that fans of EXPERIMENTAL/ART games like "${title}"${devContext} would love.

Description: ${description}

Look for recommendations from:
- Art game communities
- Experimental game enthusiasts
- Indie game connoisseurs who appreciate weird/unusual games

Do NOT suggest mainstream games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why art game fans love it"}]`;
  }

  if (profile.type === "narrative") {
    return `Find ${count} STORY-DRIVEN games that fans of "${title}"${devContext} recommend.

Description: ${description}

Find games with:
- Similar themes and emotional journeys
- Strong narrative focus
- Character-driven experiences

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why story lovers recommend it"}]`;
  }

  // Default community prompt
  return `Find ${count} indie games that fans of "${title}"${devContext} actually recommend.

Description: ${description}

Look for games the community loves together. Match the overall appeal.
Focus on indie games.

Write SHORT reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why fans love it"}]`;
}

// ============================================================================
// CONSENSUS DETECTION
// ============================================================================

function combineWithConsensus(
  vibeResults: RawSuggestion[],
  mechanicsResults: RawSuggestion[],
  communityResults: RawSuggestion[]
): Map<string, { count: number; reasons: string[]; sources: string[] }> {
  const combined = new Map<
    string,
    { count: number; reasons: string[]; sources: string[] }
  >();

  const addToMap = (suggestions: RawSuggestion[], source: string) => {
    for (const sug of suggestions) {
      const key = sug.title.toLowerCase().trim();
      if (combined.has(key)) {
        const existing = combined.get(key)!;
        existing.count++;
        existing.reasons.push(sug.reason);
        existing.sources.push(source);
      } else {
        combined.set(key, {
          count: 1,
          reasons: [sug.reason],
          sources: [source],
        });
      }
    }
  };

  addToMap(vibeResults, "vibe");
  addToMap(mechanicsResults, "mechanics");
  addToMap(communityResults, "community");

  return combined;
}

// ============================================================================
// TYPE-AWARE CURATION
// ============================================================================

async function curateWithAI(
  profile: GameProfile,
  sourceTitle: string,
  sourceDescription: string,
  validatedSuggestions: Array<{
    title: string;
    reason: string;
    appid: number;
    consensus: number;
  }>,
  developers: string[]
): Promise<Array<{ title: string; reason: string; appid: number }>> {
  const candidates = validatedSuggestions.slice(0, 20);
  const weights = getWeightsForType(profile.type);
  const devContext = developers.length > 0 ? ` by ${developers.join(", ")}` : "";

  const suggestionsList = candidates
    .map(
      (sug, i) =>
        `${i + 1}. "${sug.title}" (${sug.consensus}/3 strategies) - ${sug.reason}`
    )
    .join("\n");

  let typeGuidance = "";
  if (profile.type === "avant-garde") {
    typeGuidance = `
This is an AVANT-GARDE/ART game. Prioritize:
- Other weird/experimental/art games (CRITICAL)
- Games that prioritize artistic expression
- Unconventional or boundary-pushing games
- Do NOT pick mainstream games even if mechanics match`;
  } else if (profile.type === "competitive") {
    typeGuidance = `
This is a COMPETITIVE/SKILL game. Prioritize:
- Games with similar mechanical depth (${(weights.mechanics * 100).toFixed(0)}% weight)
- Strategic/tactical similarity
- Skill expression opportunities`;
  } else if (profile.type === "cozy") {
    typeGuidance = `
This is a COZY game. Prioritize:
- Relaxing, low-stress games
- Similar aesthetic and vibe (${(weights.vibe * 100).toFixed(0)}% + ${(weights.aesthetic * 100).toFixed(0)}% weight)
- Gentle, comforting experiences`;
  } else if (profile.type === "narrative") {
    typeGuidance = `
This is a NARRATIVE game. Prioritize:
- Story-driven experiences (${(weights.theme * 100).toFixed(0)}% weight)
- Similar themes and emotional journeys
- Character-focused games`;
  }

  // Count high consensus for guidance
  const highConsensusGames = candidates.filter((c) => c.consensus >= 2).length;
  const consensusGuidance =
    highConsensusGames >= 5
      ? `\nIMPORTANT: ${highConsensusGames} games have 2+/3 consensus. STRONGLY prefer these - they were independently identified by multiple search strategies as good matches. Only pick 1/3 consensus games if they're exceptional matches.`
      : highConsensusGames >= 2
        ? `\nNote: ${highConsensusGames} games have 2+/3 consensus. Prefer these when possible.`
        : "";

  const prompt = `Curate game recommendations for "${sourceTitle}"${devContext}.

Game type: ${profile.type.toUpperCase()}
Description: ${sourceDescription}
${typeGuidance}
${consensusGuidance}

Candidates (sorted by consensus - higher is better):
${suggestionsList}

SELECTION RULES:
1. STRONGLY prefer games with 2/3 or 3/3 consensus (mentioned by multiple strategies)
2. Only pick 1/3 consensus games if they're clearly better matches than available 2+/3 games
3. Match the game type (see guidance above)
4. Prefer indie games over AAA
5. ONLY select from the candidates list above - do not add other games

Write concise reasons (under 15 words).
Return ONLY JSON: [{"title":"Game Name","reason":"Why it's a great match"}]`;

  try {
    const { text } = await generateText({
      model: "openai/gpt-4o-mini",
      prompt,
    });

    const match = text.match(/\[[\s\S]*\]/);
    if (!match) {
      return candidates.slice(0, 10).map((sug) => ({
        title: sug.title,
        reason: sug.reason,
        appid: sug.appid,
      }));
    }

    const curated = JSON.parse(match[0]) as Array<{
      title: string;
      reason: string;
    }>;

    const curatedResults: Array<{
      title: string;
      reason: string;
      appid: number;
    }> = [];
    const usedAppids = new Set<number>();

    for (const item of curated.slice(0, 10)) {
      const key = item.title.toLowerCase().trim();
      const original = candidates.find((sug) => sug.title.toLowerCase() === key);
      if (original && !usedAppids.has(original.appid)) {
        curatedResults.push({
          title: original.title,
          reason: item.reason,
          appid: original.appid,
        });
        usedAppids.add(original.appid);
      }
    }

    // If curation returned too few (AI hallucinated games not in candidates),
    // fill with top consensus games we haven't used yet
    if (curatedResults.length < 10) {
      const remaining = candidates
        .filter((c) => !usedAppids.has(c.appid))
        .slice(0, 10 - curatedResults.length);

      for (const sug of remaining) {
        curatedResults.push({
          title: sug.title,
          reason: sug.reason,
          appid: sug.appid,
        });
      }

      if (remaining.length > 0) {
        console.log(
          `[SUGGEST] Curation returned ${curatedResults.length - remaining.length} valid results, filled ${remaining.length} from top consensus`
        );
      }
    }

    return curatedResults;
  } catch (err) {
    console.error("[SUGGEST] AI curation failed:", err);
    return candidates.slice(0, 10).map((sug) => ({
      title: sug.title,
      reason: sug.reason,
      appid: sug.appid,
    }));
  }
}

// ============================================================================
// QUALITY THRESHOLDS
// ============================================================================

const MIN_STRATEGY_RESULTS = 3; // Retry if strategy returns fewer than this
const MIN_HIGH_CONSENSUS = 4; // Retry full pipeline if fewer than this many 2+ consensus games

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Adaptive suggestion system that detects game type and adjusts strategy.
 *
 * Game types:
 * - avant-garde: Art/experimental games - prioritizes weird/unique over mechanics
 * - cozy: Relaxation games - prioritizes vibe/aesthetic
 * - competitive: Skill games - prioritizes mechanics (65%)
 * - narrative: Story games - prioritizes theme/emotional journey
 * - mainstream: Balanced approach
 *
 * Known art-game developers trigger automatic avant-garde detection.
 *
 * Quality checks:
 * - Retries individual strategies if they return < 3 results
 * - Retries full pipeline if consensus is too low
 * - Prioritizes high-consensus games in curation
 */
export async function suggestGamesVibe(
  sourceAppid: number,
  sourceTitle: string,
  sourceDescription?: string,
  developers?: string[],
  count = 10
): Promise<VibeResult> {
  const totalStart = Date.now();
  const devs = developers || [];
  const desc = sourceDescription || "";

  // Step 1: Detect game type
  const profilingStart = Date.now();
  const profile = await detectGameType(sourceTitle, desc, devs);
  const profilingTime = Date.now() - profilingStart;

  console.log(
    `[SUGGEST] ${sourceTitle}: detected as ${profile.type} (${(profile.typeConfidence * 100).toFixed(0)}% confidence)${profile.isKnownArtDev ? " [known art dev]" : ""}`
  );

  // Step 2: Run strategies with quality-aware retries
  async function runAllStrategies(): Promise<{
    vibe: { raw: RawSuggestion[]; elapsed: number };
    mechanics: { raw: RawSuggestion[]; elapsed: number };
    community: { raw: RawSuggestion[]; elapsed: number };
  }> {
    // Run all three in parallel
    const [vibe, mechanics, community] = await Promise.all([
      runStrategyWithRetry(buildVibePrompt(profile, sourceTitle, desc, devs, 12)),
      runStrategyWithRetry(buildMechanicsPrompt(profile, sourceTitle, desc, devs, 12)),
      runStrategyWithRetry(buildCommunityPrompt(profile, sourceTitle, desc, devs, 12)),
    ]);

    // Retry any that returned too few results
    const retries: Promise<void>[] = [];
    let vibeResult = vibe;
    let mechanicsResult = mechanics;
    let communityResult = community;

    if (vibe.raw.length < MIN_STRATEGY_RESULTS) {
      console.log(`[SUGGEST] Vibe returned ${vibe.raw.length}, retrying...`);
      retries.push(
        runStrategyWithRetry(buildVibePrompt(profile, sourceTitle, desc, devs, 12)).then(
          (r) => { vibeResult = r; }
        )
      );
    }
    if (mechanics.raw.length < MIN_STRATEGY_RESULTS) {
      console.log(`[SUGGEST] Mechanics returned ${mechanics.raw.length}, retrying...`);
      retries.push(
        runStrategyWithRetry(buildMechanicsPrompt(profile, sourceTitle, desc, devs, 12)).then(
          (r) => { mechanicsResult = r; }
        )
      );
    }
    if (community.raw.length < MIN_STRATEGY_RESULTS) {
      console.log(`[SUGGEST] Community returned ${community.raw.length}, retrying...`);
      retries.push(
        runStrategyWithRetry(buildCommunityPrompt(profile, sourceTitle, desc, devs, 12)).then(
          (r) => { communityResult = r; }
        )
      );
    }

    if (retries.length > 0) {
      await Promise.all(retries);
    }

    return { vibe: vibeResult, mechanics: mechanicsResult, community: communityResult };
  }

  // Run strategies, retry full pipeline if consensus is too low
  let strategyResults = await runAllStrategies();
  let strategiesTime = Math.max(
    strategyResults.vibe.elapsed,
    strategyResults.mechanics.elapsed,
    strategyResults.community.elapsed
  );

  console.log(
    `[SUGGEST] Strategy results: vibe=${strategyResults.vibe.raw.length}, mechanics=${strategyResults.mechanics.raw.length}, community=${strategyResults.community.raw.length}`
  );

  // Step 3: Combine with consensus detection
  let combined = combineWithConsensus(
    strategyResults.vibe.raw,
    strategyResults.mechanics.raw,
    strategyResults.community.raw
  );

  // Quality check: count high-consensus games
  let highConsensusCount = Array.from(combined.values()).filter(
    (v) => v.count >= 2
  ).length;

  // If consensus is too low, retry the entire pipeline once
  if (highConsensusCount < MIN_HIGH_CONSENSUS && combined.size > 0) {
    console.log(
      `[SUGGEST] Low consensus (${highConsensusCount}/${MIN_HIGH_CONSENSUS}), retrying full pipeline...`
    );

    const retryResults = await runAllStrategies();
    strategiesTime += Math.max(
      retryResults.vibe.elapsed,
      retryResults.mechanics.elapsed,
      retryResults.community.elapsed
    );

    console.log(
      `[SUGGEST] Retry results: vibe=${retryResults.vibe.raw.length}, mechanics=${retryResults.mechanics.raw.length}, community=${retryResults.community.raw.length}`
    );

    // Merge new results with old for better coverage
    const retryCombined = combineWithConsensus(
      retryResults.vibe.raw,
      retryResults.mechanics.raw,
      retryResults.community.raw
    );

    // Merge: add new games, boost consensus for existing
    for (const [key, data] of retryCombined) {
      if (combined.has(key)) {
        const existing = combined.get(key)!;
        existing.count += data.count;
        existing.reasons.push(...data.reasons);
        existing.sources.push(...data.sources);
      } else {
        combined.set(key, data);
      }
    }

    highConsensusCount = Array.from(combined.values()).filter(
      (v) => v.count >= 2
    ).length;
    console.log(`[SUGGEST] After merge: ${combined.size} unique, ${highConsensusCount} high-consensus`);
  }

  if (combined.size === 0) {
    return {
      suggestions: [],
      timing: {
        profiling: profilingTime,
        strategies: strategiesTime,
        validation: 0,
        curation: 0,
        total: Date.now() - totalStart,
      },
      stats: {
        gameType: profile.type,
        fromDb: 0,
        fromSteam: 0,
        unverified: 0,
        totalUnique: 0,
        highConsensus: 0,
      },
    };
  }

  // Step 4: Validate all suggestions
  const allRawSuggestions: RawSuggestion[] = Array.from(combined.entries()).map(
    ([title, data]) => ({
      title,
      reason: data.reasons[0],
    })
  );

  const { validated, elapsed: validationTime } =
    await validateSuggestions(allRawSuggestions);

  // Filter and add consensus info
  const validatedWithConsensus = validated
    .filter(
      (v) => v.appid && v.appid !== sourceAppid && v.source !== "unverified"
    )
    .map((v) => {
      const key = v.title.toLowerCase();
      const consensusData = combined.get(key);
      return {
        title: v.title,
        reason: v.reason,
        appid: v.appid!,
        consensus: consensusData?.count || 1,
      };
    })
    .sort((a, b) => b.consensus - a.consensus);

  if (validatedWithConsensus.length === 0) {
    return {
      suggestions: [],
      timing: {
        profiling: profilingTime,
        strategies: strategiesTime,
        validation: validationTime,
        curation: 0,
        total: Date.now() - totalStart,
      },
      stats: {
        gameType: profile.type,
        fromDb: 0,
        fromSteam: 0,
        unverified: 0,
        totalUnique: combined.size,
        highConsensus: Array.from(combined.values()).filter((v) => v.count >= 2)
          .length,
      },
    };
  }

  // Step 5: Type-aware AI curation
  const curationStart = Date.now();
  const curated = await curateWithAI(
    profile,
    sourceTitle,
    desc,
    validatedWithConsensus,
    devs
  );
  const curationTime = Date.now() - curationStart;

  // Convert to final suggestions
  const suggestions: Suggestion[] = curated.slice(0, count).map((c) => ({
    appId: c.appid,
    title: c.title,
    explanation: c.reason,
    category: "niche" as const,
  }));

  const highConsensus = Array.from(combined.values()).filter(
    (v) => v.count >= 2
  ).length;

  return {
    suggestions,
    timing: {
      profiling: profilingTime,
      strategies: strategiesTime,
      validation: validationTime,
      curation: curationTime,
      total: Date.now() - totalStart,
    },
    stats: {
      gameType: profile.type,
      fromDb: validated.filter((s) => s.source === "db").length,
      fromSteam: validated.filter((s) => s.source === "steam").length,
      unverified: validated.filter((s) => s.source === "unverified").length,
      totalUnique: combined.size,
      highConsensus,
    },
  };
}

export async function suggestGamesVibeFromAppId(
  sourceAppid: number,
  count = 10
): Promise<VibeResult> {
  const supabase = getSupabaseServerClient();

  const { data: game, error } = await supabase
    .from("games_new")
    .select("title, short_description, developers")
    .eq("appid", sourceAppid)
    .single();

  if (error || !game) {
    throw new Error(`Game ${sourceAppid} not found`);
  }

  return suggestGamesVibe(
    sourceAppid,
    game.title,
    game.short_description || undefined,
    game.developers || undefined,
    count
  );
}
