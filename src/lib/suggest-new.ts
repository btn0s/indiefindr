import { generateText } from "ai";
import { getSupabaseServerClient } from "./supabase/server";
import { Suggestion } from "./supabase/types";

export type VibeResult = {
  suggestions: Suggestion[];
  timing: {
    perplexity: number;
    validation: number;
    total: number;
  };
  stats: {
    fromDb: number;
    fromSteam: number;
    unverified: number;
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

async function getPerplexitySuggestions(
  gameTitle: string,
  gameDescription?: string,
  developers?: string[],
  count = 10,
  retries = 2
): Promise<{ raw: RawSuggestion[]; elapsed: number }> {
  const start = Date.now();

  const descContext = gameDescription
    ? ` (${gameDescription.slice(0, 200)})`
    : "";

  const devContext = developers && developers.length > 0
    ? ` by ${developers.join(", ")}`
    : "";

  const prompt = `Find ${count} indie games similar to "${gameTitle}"${devContext}${descContext}.

Match the core loop, vibe, tone, pacing, and aesthetic. Consider games from similar developers.
Focus on indie/small studio games. Avoid AAA titles and big-budget games from major publishers.

Write SHORT reasons (under 15 words).
Return ONLY valid JSON: [{"title":"Game Name","reason":"Why it matches"}]`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const { text } = await generateText({
        model: "perplexity/sonar",
        prompt,
      });

      const match = text.match(/\[[\s\S]*\]/);
      if (!match) {
        if (attempt < retries) {
          console.error(`[SUGGEST-VIBE] No JSON array found, retrying (${attempt + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        console.error("[SUGGEST-VIBE] No JSON array found in response");
        return { raw: [], elapsed: Date.now() - start };
      }

      try {
        const parsed = JSON.parse(match[0]) as RawSuggestion[];
        return { raw: parsed, elapsed: Date.now() - start };
      } catch (parseErr) {
        if (attempt < retries) {
          console.error(`[SUGGEST-VIBE] JSON parse error, retrying (${attempt + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }
        console.error("[SUGGEST-VIBE] JSON parse error:", parseErr);
        console.error("[SUGGEST-VIBE] Raw matched text:", match[0].substring(0, 500));
        return { raw: [], elapsed: Date.now() - start };
      }
    } catch (err) {
      if (attempt < retries) {
        console.error(`[SUGGEST-VIBE] Perplexity error, retrying (${attempt + 1}/${retries})...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      console.error("[SUGGEST-VIBE] Perplexity error:", err);
      return { raw: [], elapsed: Date.now() - start };
    }
  }

  return { raw: [], elapsed: Date.now() - start };
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

/**
 * Vibe-based suggestion using Perplexity web search.
 *
 * Why Perplexity over embeddings:
 * - Embeddings match text patterns ("first-person", "space setting")
 * - Perplexity matches what the community actually recommends
 * - For art-first games like Mouthwashing, vibe > tags
 *
 * Trade-off: ~5-7s latency vs instant but lower quality embeddings.
 */
export async function suggestGamesVibe(
  sourceAppid: number,
  sourceTitle: string,
  sourceDescription?: string,
  developers?: string[],
  count = 10
): Promise<VibeResult> {
  const totalStart = Date.now();

  const { raw, elapsed: perplexityTime } = await getPerplexitySuggestions(
    sourceTitle,
    sourceDescription,
    developers,
    count
  );

  if (raw.length === 0) {
    return {
      suggestions: [],
      timing: { perplexity: perplexityTime, validation: 0, total: Date.now() - totalStart },
      stats: { fromDb: 0, fromSteam: 0, unverified: 0 },
    };
  }

  const { validated, elapsed: validationTime } = await validateSuggestions(raw);

  const suggestions: Suggestion[] = validated
    .filter((s) => s.appid && s.appid !== sourceAppid)
    .map((s) => ({
      appId: s.appid!,
      title: s.title,
      explanation: s.reason,
      category: "niche" as const,
    }));

  const stats = {
    fromDb: validated.filter((s) => s.source === "db").length,
    fromSteam: validated.filter((s) => s.source === "steam").length,
    unverified: validated.filter((s) => s.source === "unverified").length,
  };

  return {
    suggestions,
    timing: {
      perplexity: perplexityTime,
      validation: validationTime,
      total: Date.now() - totalStart,
    },
    stats,
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
