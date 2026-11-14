import { cacheLife } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SHELVES } from "@/lib/catalog";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
const urlset = (entries: string[]) => `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries.join("")}</urlset>`;

/** Hand-built pages: home and the discovery shelves. */
const pagesSitemap = () => urlset(["", ...Object.keys(SHELVES).map(slug => `/discover/${slug}`)]
  .map(path => `<url><loc>${SITE}${path}</loc><changefreq>daily</changefreq></url>`));

/** Games appid-ordered, 10,000 per shard. Null when the catalog is unavailable; empty when the shard has no games. */
async function gamesSitemap(shard: number) {
  "use cache";
  cacheLife("hours");
  const entries: string[] = [];
  for (let offset = shard * 10000; offset < (shard + 1) * 10000; offset += 1000) {
    const { data, error } = await getSupabaseServerClient().from("games").select("appid,updated_at").order("appid").range(offset, offset + 999);
    if (error) return null;
    entries.push(...data.map(game => `<url><loc>${SITE}/games/${game.appid}</loc><lastmod>${new Date(game.updated_at).toISOString()}</lastmod></url>`));
    if (data.length < 1000) break;
  }
  return entries.length ? urlset(entries) : "";
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const xmlResponse = (xml: string) => new Response(xml, { headers: { "Content-Type": "application/xml" } });
  if (id === "pages.xml") return xmlResponse(pagesSitemap());
  if (!/^\d+\.xml$/.test(id)) return new Response(null, { status: 404 });
  const xml = await gamesSitemap(Number(id.slice(0, -4)));
  if (xml === null) return new Response(null, { status: 503 });
  return xml ? xmlResponse(xml) : new Response(null, { status: 404 });
}
