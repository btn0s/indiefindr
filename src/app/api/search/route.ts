import { searchGames } from "@/lib/agent-catalog";

export const preferredRegion = "pdx1";

/** Title search shared by the search box, agents and the CLI. /api/agent-search and /api/games/search rewrite here. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim();
  if (!q || q.length > 200) return Response.json({ error: "Supply q with 1–200 characters." }, { status: 400 });
  try {
    return Response.json({ games: await searchGames(q) }, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return Response.json({ error: "Search unavailable. Retry shortly." }, { status: 503 });
  }
}
