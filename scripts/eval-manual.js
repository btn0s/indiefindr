#!/usr/bin/env node
/**
 * Evaluate current embeddings against manual similarity links stored in Supabase.
 *
 * Usage: node scripts/eval-manual.js
 *
 * Looks up rows in manual_similarities, queries get_related_games for each facet,
 * and reports hit rate, ranks, and similarities.
 */
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) to run evaluation."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchManualLinks() {
  const { data, error } = await supabase
    .from("manual_similarities")
    .select("*");
  if (error) throw error;
  return data || [];
}

async function fetchGameNames(ids) {
  if (ids.size === 0) return {};
  const { data, error } = await supabase
    .from("games")
    .select("id, name")
    .in("id", Array.from(ids));
  if (error) throw error;
  const map = {};
  (data || []).forEach((g) => {
    map[g.id] = g.name;
  });
  return map;
}

async function evaluateLink(link, facet, names) {
  const { data, error } = await supabase.rpc("get_related_games", {
    p_appid: link.source_appid,
    p_facet: facet,
    p_limit: 50,
    p_threshold: 0,
  });

  if (error) {
    return { facet, error: error.message };
  }

  const results = data || [];
  const rank = results.findIndex((g) => g.appid === link.target_appid);
  const hit = rank !== -1;
  const similarity = hit ? results[rank].similarity : null;
  const top = results[0];

  return {
    facet,
    hit,
    rank: hit ? rank + 1 : null,
    similarity,
    targetName: names[link.target_appid] || String(link.target_appid),
    sourceName: names[link.source_appid] || String(link.source_appid),
    topCandidate: top
      ? { appid: top.appid, name: top.name, similarity: top.similarity }
      : null,
  };
}

async function main() {
  const links = await fetchManualLinks();
  if (links.length === 0) {
    console.log("No manual_similarities found. Add links in the UI first.");
    return;
  }

  const idSet = new Set();
  links.forEach((l) => {
    idSet.add(l.source_appid);
    idSet.add(l.target_appid);
  });
  const names = await fetchGameNames(idSet);

  const results = [];
  for (const link of links) {
    const facets =
      (link.facets && link.facets.length > 0 ? link.facets : ["overall"]).map(
        (f) => f.toLowerCase()
      );
    const facetsToCheck = facets.includes("overall")
      ? ["aesthetic", "gameplay", "narrative"]
      : facets;

    for (const facet of facetsToCheck) {
      const res = await evaluateLink(link, facet, names);
      results.push(res);
    }
  }

  const clean = results.filter((r) => !r.error);
  if (clean.length === 0) {
    console.log("No successful evaluations (errors occurred).");
    results
      .filter((r) => r.error)
      .forEach((r) => console.log(`${r.facet}: ${r.error}`));
    return;
  }

  const hitCount = clean.filter((r) => r.hit).length;
  const total = clean.length;
  const hitRate = ((hitCount / total) * 100).toFixed(1);

  const byFacet = clean.reduce((acc, r) => {
    if (!acc[r.facet]) acc[r.facet] = { total: 0, hits: 0 };
    acc[r.facet].total += 1;
    acc[r.facet].hits += r.hit ? 1 : 0;
    return acc;
  }, {});

  console.log(`Manual link eval: ${hitCount}/${total} hits (${hitRate}%).`);
  Object.entries(byFacet).forEach(([facet, stats]) => {
    const rate = ((stats.hits / stats.total) * 100).toFixed(1);
    console.log(`- ${facet}: ${stats.hits}/${stats.total} hits (${rate}%)`);
  });

  const misses = clean.filter((r) => !r.hit);
  if (misses.length > 0) {
    console.log("\nMisses (target not in top-N):");
    misses.slice(0, 20).forEach((miss) => {
      const { sourceName, targetName, facet, topCandidate } = miss;
      const topLine = topCandidate
        ? ` top: ${topCandidate.name} (${(topCandidate.similarity * 100).toFixed(
            1
          )}%)`
        : " top: none";
      console.log(
        `- ${sourceName} → ${targetName} [${facet}]${topLine}`
      );
    });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
