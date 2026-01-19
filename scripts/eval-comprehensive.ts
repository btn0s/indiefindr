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
  category: string;
  facet_similarities: Record<FacetType, number | null>;
  avg_similarity: number;
  pass: boolean;
  margin: number;
}

interface ComprehensiveMetrics {
  overall_accuracy: number;
  discrimination_gap: number;
  by_category: Record<string, { passed: number; total: number; accuracy: number }>;
  by_facet: Record<FacetType, {
    avg_similarity: number;
    coverage: number;
    correlation_with_expected: number;
  }>;
  consensus_metrics: {
    multi_facet_agreement_rate: number;
    avg_facets_per_pair: number;
    facet_correlation: Record<string, number>;
  };
  threshold_analysis: {
    very_high: { avg: number; min: number; max: number; count: number };
    high: { avg: number; min: number; max: number; count: number };
    moderate: { avg: number; min: number; max: number; count: number };
    low: { avg: number; min: number; max: number; count: number };
  };
  failure_analysis: {
    close_calls: Array<{ pair: string; expected: string; actual: number; margin: number }>;
    worst_performers: Array<{ pair: string; expected: string; actual: number; gap: number }>;
  };
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

async function evaluatePair(
  pair: any,
  category: string
): Promise<EvalResult> {
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
  let margin = 0;
  
  if (threshold.min !== undefined && threshold.max !== undefined) {
    pass = avg_similarity >= threshold.min && avg_similarity <= threshold.max;
    const minMargin = avg_similarity - threshold.min;
    const maxMargin = threshold.max - avg_similarity;
    margin = Math.min(minMargin, maxMargin);
  } else if (threshold.min !== undefined) {
    pass = avg_similarity >= threshold.min;
    margin = avg_similarity - threshold.min;
  } else if (threshold.max !== undefined) {
    pass = avg_similarity <= threshold.max;
    margin = threshold.max - avg_similarity;
  }

  return {
    source: pair.source,
    target: pair.target,
    source_title: pair.source_title,
    target_title: pair.target_title,
    expected: pair.expected_similarity,
    category,
    facet_similarities,
    avg_similarity,
    pass,
    margin,
  };
}

function calculateComprehensiveMetrics(results: EvalResult[]): ComprehensiveMetrics {
  const passed = results.filter(r => r.pass).length;
  const overall_accuracy = passed / results.length;

  const by_category: Record<string, { passed: number; total: number; accuracy: number }> = {};
  for (const result of results) {
    if (!by_category[result.category]) {
      by_category[result.category] = { passed: 0, total: 0, accuracy: 0 };
    }
    by_category[result.category].total++;
    if (result.pass) by_category[result.category].passed++;
  }
  for (const cat in by_category) {
    by_category[cat].accuracy = by_category[cat].passed / by_category[cat].total;
  }

  const facets: FacetType[] = ["aesthetic", "atmosphere", "mechanics", "narrative"];
  const by_facet: Record<FacetType, any> = {} as any;
  
  for (const facet of facets) {
    const sims = results.map(r => r.facet_similarities[facet]).filter(s => s !== null) as number[];
    const coverage = sims.length / results.length;
    const avg_similarity = sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 0;
    
    const expectedScores = results.map(r => {
      const thresh = groundTruth.similarity_thresholds[r.expected as keyof typeof groundTruth.similarity_thresholds];
      return thresh.ideal;
    });
    const actualScores = results.map(r => r.facet_similarities[facet] || 0);
    const correlation = calculateCorrelation(expectedScores, actualScores);
    
    by_facet[facet] = { avg_similarity, coverage, correlation_with_expected: correlation };
  }

  const multi_facet_pairs = results.filter(r => {
    const validFacets = Object.values(r.facet_similarities).filter(s => s !== null).length;
    return validFacets >= 2;
  });
  const multi_facet_agreement_rate = multi_facet_pairs.length / results.length;
  const avg_facets_per_pair = results.reduce((sum, r) => {
    return sum + Object.values(r.facet_similarities).filter(s => s !== null).length;
  }, 0) / results.length;

  const facet_correlation: Record<string, number> = {};
  for (let i = 0; i < facets.length; i++) {
    for (let j = i + 1; j < facets.length; j++) {
      const f1 = facets[i];
      const f2 = facets[j];
      const pairs = results.filter(r => r.facet_similarities[f1] !== null && r.facet_similarities[f2] !== null);
      const scores1 = pairs.map(r => r.facet_similarities[f1]!);
      const scores2 = pairs.map(r => r.facet_similarities[f2]!);
      facet_correlation[`${f1}_${f2}`] = calculateCorrelation(scores1, scores2);
    }
  }

  const threshold_analysis: any = {};
  for (const level of ["very_high", "high", "moderate", "low"]) {
    const levelResults = results.filter(r => r.expected === level);
    const sims = levelResults.map(r => r.avg_similarity);
    threshold_analysis[level] = {
      avg: sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 0,
      min: sims.length > 0 ? Math.min(...sims) : 0,
      max: sims.length > 0 ? Math.max(...sims) : 0,
      count: sims.length,
    };
  }

  const highSimilarResults = results.filter(r => r.expected === "very_high" || r.expected === "high");
  const lowSimilarResults = results.filter(r => r.expected === "low");
  const highAvg = highSimilarResults.length > 0 
    ? highSimilarResults.reduce((sum, r) => sum + r.avg_similarity, 0) / highSimilarResults.length 
    : 0;
  const lowAvg = lowSimilarResults.length > 0
    ? lowSimilarResults.reduce((sum, r) => sum + r.avg_similarity, 0) / lowSimilarResults.length
    : 0;
  const discrimination_gap = highAvg - lowAvg;

  const close_calls = results
    .filter(r => Math.abs(r.margin) < 0.05)
    .sort((a, b) => Math.abs(a.margin) - Math.abs(b.margin))
    .slice(0, 5)
    .map(r => ({
      pair: `${r.source_title} ↔ ${r.target_title}`,
      expected: r.expected,
      actual: r.avg_similarity,
      margin: r.margin,
    }));

  const worst_performers = results
    .filter(r => !r.pass)
    .sort((a, b) => Math.abs(b.margin) - Math.abs(a.margin))
    .slice(0, 5)
    .map(r => ({
      pair: `${r.source_title} ↔ ${r.target_title}`,
      expected: r.expected,
      actual: r.avg_similarity,
      gap: Math.abs(r.margin),
    }));

  return {
    overall_accuracy,
    discrimination_gap,
    by_category,
    by_facet,
    consensus_metrics: {
      multi_facet_agreement_rate,
      avg_facets_per_pair,
      facet_correlation,
    },
    threshold_analysis,
    failure_analysis: {
      close_calls,
      worst_performers,
    },
  };
}

function calculateCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;
  
  const n = x.length;
  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;
  
  let num = 0;
  let denX = 0;
  let denY = 0;
  
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  
  return num / Math.sqrt(denX * denY);
}

async function main() {
  console.log("=".repeat(80));
  console.log("COMPREHENSIVE EMBEDDING EVALUATION");
  console.log("=".repeat(80));
  console.log();

  const allPairs = Object.entries(groundTruth.pairs).flatMap(([category, pairs]) =>
    (pairs as any[]).map(pair => ({ ...pair, category }))
  );

  console.log(`Evaluating ${allPairs.length} pairs across ${Object.keys(groundTruth.pairs).length} categories...\n`);

  const results: EvalResult[] = [];
  for (const pair of allPairs) {
    const result = await evaluatePair(pair, pair.category);
    results.push(result);
  }

  const metrics = calculateComprehensiveMetrics(results);

  console.log("## OVERALL PERFORMANCE");
  console.log(`Accuracy: ${(metrics.overall_accuracy * 100).toFixed(1)}%`);
  console.log(`Passed: ${results.filter(r => r.pass).length}/${results.length}`);
  console.log(`Discrimination Gap: ${(metrics.discrimination_gap * 100).toFixed(1)}% (high vs low similarity avg difference)`);
  console.log(`  → Target: >15% gap. Current gap is ${metrics.discrimination_gap < 0.15 ? "TOO SMALL" : "OK"}`);
  console.log();

  console.log("## BY CATEGORY");
  for (const [cat, stats] of Object.entries(metrics.by_category)) {
    console.log(`  ${cat}: ${(stats.accuracy * 100).toFixed(1)}% (${stats.passed}/${stats.total})`);
  }
  console.log();

  console.log("## BY FACET");
  for (const [facet, stats] of Object.entries(metrics.by_facet)) {
    console.log(`  ${facet}:`);
    console.log(`    Avg similarity: ${(stats.avg_similarity * 100).toFixed(1)}%`);
    console.log(`    Coverage: ${(stats.coverage * 100).toFixed(1)}%`);
    console.log(`    Correlation with expected: ${stats.correlation_with_expected.toFixed(3)}`);
  }
  console.log();

  console.log("## CONSENSUS METRICS");
  console.log(`  Multi-facet agreement rate: ${(metrics.consensus_metrics.multi_facet_agreement_rate * 100).toFixed(1)}%`);
  console.log(`  Avg facets per pair: ${metrics.consensus_metrics.avg_facets_per_pair.toFixed(1)}`);
  console.log(`  Facet correlations:`);
  for (const [pair, corr] of Object.entries(metrics.consensus_metrics.facet_correlation)) {
    console.log(`    ${pair}: ${corr.toFixed(3)}`);
  }
  console.log();

  console.log("## THRESHOLD ANALYSIS");
  for (const [level, stats] of Object.entries(metrics.threshold_analysis)) {
    console.log(`  ${level}: avg=${(stats.avg * 100).toFixed(1)}%, range=${(stats.min * 100).toFixed(1)}%-${(stats.max * 100).toFixed(1)}% (n=${stats.count})`);
  }
  console.log();

  if (metrics.failure_analysis.close_calls.length > 0) {
    console.log("## CLOSE CALLS (margin < 5%)");
    for (const call of metrics.failure_analysis.close_calls) {
      console.log(`  ${call.pair}`);
      console.log(`    Expected: ${call.expected}, Actual: ${(call.actual * 100).toFixed(1)}%, Margin: ${(call.margin * 100).toFixed(1)}%`);
    }
    console.log();
  }

  if (metrics.failure_analysis.worst_performers.length > 0) {
    console.log("## FAILURES");
    for (const fail of metrics.failure_analysis.worst_performers) {
      console.log(`  ${fail.pair}`);
      console.log(`    Expected: ${fail.expected}, Actual: ${(fail.actual * 100).toFixed(1)}%, Gap: ${(fail.gap * 100).toFixed(1)}%`);
    }
    console.log();
  }

  console.log("=".repeat(80));
  console.log("DETAILED RESULTS");
  console.log("=".repeat(80));
  console.log();

  for (const result of results) {
    const icon = result.pass ? "✓" : "✗";
    console.log(`${icon} ${result.source_title} ↔ ${result.target_title}`);
    console.log(`  Category: ${result.category}`);
    console.log(`  Expected: ${result.expected}, Avg: ${(result.avg_similarity * 100).toFixed(1)}%, Margin: ${(result.margin * 100).toFixed(1)}%`);
    console.log(`  Facets: A=${fmt(result.facet_similarities.aesthetic)} At=${fmt(result.facet_similarities.atmosphere)} M=${fmt(result.facet_similarities.mechanics)} N=${fmt(result.facet_similarities.narrative)}`);
    console.log();
  }
}

function fmt(val: number | null): string {
  return val === null ? "N/A" : `${(val * 100).toFixed(0)}%`;
}

main().catch(console.error);
