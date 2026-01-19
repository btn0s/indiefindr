import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import groundTruth from "./ground-truth-realistic.json";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FacetType = "aesthetic" | "atmosphere" | "mechanics" | "narrative";

interface EvalResult {
  source: number;
  target: number;
  source_title: string;
  target_title: string;
  expected: string;
  facet_similarities: Record<FacetType, number | null>;
  avg_similarity: number;
  pass: boolean;
}

async function getSimilarity(
  sourceAppid: number,
  targetAppid: number,
  facet: FacetType
): Promise<number | null> {
  const { data: sourceEmb } = await supabase
    .from("game_embeddings")
    .select("embedding")
    .eq("appid", sourceAppid)
    .eq("facet", facet)
    .single();

  const { data: targetEmb } = await supabase
    .from("game_embeddings")
    .select("embedding")
    .eq("appid", targetAppid)
    .eq("facet", facet)
    .single();

  if (!sourceEmb?.embedding || !targetEmb?.embedding) return null;

  const src = typeof sourceEmb.embedding === 'string' 
    ? JSON.parse(sourceEmb.embedding) as number[]
    : sourceEmb.embedding as number[];
  const tgt = typeof targetEmb.embedding === 'string'
    ? JSON.parse(targetEmb.embedding) as number[]
    : targetEmb.embedding as number[];

  let dot = 0;
  let srcMag = 0;
  let tgtMag = 0;
  for (let i = 0; i < src.length; i++) {
    dot += src[i] * tgt[i];
    srcMag += src[i] * src[i];
    tgtMag += tgt[i] * tgt[i];
  }

  return dot / (Math.sqrt(srcMag) * Math.sqrt(tgtMag));
}

async function evaluatePair(pair: {
  source: number;
  target: number;
  source_title: string;
  target_title: string;
  expected_similarity: string;
}): Promise<EvalResult> {
  const facets: FacetType[] = ["aesthetic", "atmosphere", "mechanics", "narrative"];
  const facet_similarities: Record<FacetType, number | null> = {
    aesthetic: null,
    atmosphere: null,
    mechanics: null,
    narrative: null,
  };

  for (const facet of facets) {
    facet_similarities[facet] = await getSimilarity(pair.source, pair.target, facet);
  }

  const validSims = Object.values(facet_similarities).filter((s) => s !== null) as number[];
  const avg_similarity = validSims.length > 0 ? validSims.reduce((a, b) => a + b, 0) / validSims.length : 0;

  const thresholds = groundTruth.similarity_thresholds as Record<string, { min?: number; max?: number; ideal: number }>;
  const threshold = thresholds[pair.expected_similarity];

  let pass = false;
  if (threshold.min !== undefined) {
    pass = avg_similarity >= threshold.min;
  } else if (threshold.max !== undefined) {
    pass = avg_similarity <= threshold.max;
  }

  return {
    source: pair.source,
    target: pair.target,
    source_title: pair.source_title,
    target_title: pair.target_title,
    expected: pair.expected_similarity,
    facet_similarities,
    avg_similarity,
    pass,
  };
}

async function main() {
  console.log("\n=== Ground Truth Evaluation ===\n");

  const allPairs = Object.values(groundTruth.pairs).flat();

  const results: EvalResult[] = [];
  let passed = 0;
  let failed = 0;

  for (const pair of allPairs) {
    const result = await evaluatePair(pair);
    results.push(result);

    const icon = result.pass ? "✓" : "✗";
    console.log(`${icon} ${result.source_title} ↔ ${result.target_title}`);
    console.log(`  Expected: ${result.expected}, Avg: ${(result.avg_similarity * 100).toFixed(1)}%`);
    console.log(
      `  Facets: A=${fmt(result.facet_similarities.aesthetic)} At=${fmt(result.facet_similarities.atmosphere)} M=${fmt(result.facet_similarities.mechanics)} N=${fmt(result.facet_similarities.narrative)}`
    );
    console.log("");

    if (result.pass) passed++;
    else failed++;
  }

  console.log("=== Summary ===");
  console.log(`Passed: ${passed}/${allPairs.length}`);
  console.log(`Failed: ${failed}/${allPairs.length}`);
  console.log(`Accuracy: ${((passed / allPairs.length) * 100).toFixed(1)}%`);

  const byCategory = {
    same_series: results.filter((r) => r.expected === "very_high"),
    high: results.filter((r) => r.expected === "high"),
    moderate: results.filter((r) => r.expected === "moderate"),
    low: results.filter((r) => r.expected === "low"),
  };

  console.log("\nBy category:");
  for (const [cat, catResults] of Object.entries(byCategory)) {
    const catPassed = catResults.filter((r) => r.pass).length;
    console.log(`  ${cat}: ${catPassed}/${catResults.length}`);
  }
}

function fmt(val: number | null): string {
  return val === null ? "N/A" : `${(val * 100).toFixed(0)}%`;
}

main().catch(console.error);
