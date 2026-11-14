import { BROWSE_PAGE_SIZE, getBrowsePage } from "@/lib/catalog";

export const preferredRegion = "pdx1";

/** Browse all's next page (GameGrid's infinite scroll). A plain GET, so pages load in parallel and the CDN serves them:
 *  the catalog changes hourly at most, like the cached read behind it. Offsets are whole pages only, which keeps the
 *  number of distinct cached responses bounded. */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("offset") ?? "";
  const offset = Number(raw);
  if (!/^\d{1,6}$/.test(raw) || offset % BROWSE_PAGE_SIZE) {
    return Response.json({ error: `Use an offset that is a multiple of ${BROWSE_PAGE_SIZE}.` }, { status: 400 });
  }
  return Response.json(await getBrowsePage(offset), {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
