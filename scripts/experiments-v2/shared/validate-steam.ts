// Search Steam API for a game by title
export async function searchSteam(
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

// Validate against Steam (source of truth), with DB as fast cache
export async function validateSuggestion(
  title: string,
  dbGameMap: Map<string, number>
): Promise<{ appid?: number; validated: boolean; source: "db" | "steam" | "not_found" }> {
  // Try DB first (fast cache)
  const exactMatch = dbGameMap.get(title.toLowerCase().trim());
  if (exactMatch) {
    return { appid: exactMatch, validated: true, source: "db" };
  }

  // Try partial match in DB
  for (const [key, appid] of dbGameMap.entries()) {
    if (title.toLowerCase().includes(key) || key.includes(title.toLowerCase())) {
      return { appid, validated: true, source: "db" };
    }
  }

  // Not in DB - check Steam (source of truth)
  const steamResult = await searchSteam(title);
  if (steamResult) {
    return { appid: steamResult.appid, validated: true, source: "steam" };
  }

  // Not found anywhere - this is a true hallucination
  return { validated: false, source: "not_found" };
}

export async function buildGameMap(
  supabase: any
): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("games_new")
    .select("appid, title");

  const map = new Map<string, number>();
  if (data) {
    for (const game of data) {
      map.set(game.title.toLowerCase().trim(), game.appid);
    }
  }
  return map;
}
