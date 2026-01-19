import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import groundTruth from "./ground-truth-realistic.json";
import * as fs from "fs";
import * as path from "path";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type FacetType = "aesthetic" | "atmosphere" | "mechanics" | "narrative";

interface BaselineMetrics {
  timestamp: string;
  overall_accuracy: number;
  by_facet: Record<FacetType, {
    avg_similarity: number;
    coverage: number;
    correlation_with_expected: number;
  }>;
  threshold_analysis: Record<string, {
    avg: number;
    min: number;
    max: number;
    count: number;
  }>;
}

interface RegressionResult {
  has_regression: boolean;
  regressions: Array<{
    metric: string;
    baseline: number;
    current: number;
    change: number;
    severity: "critical" | "warning" | "minor";
  }>;
  improvements: Array<{
    metric: string;
    baseline: number;
    current: number;
    change: number;
  }>;
}

const BASELINE_FILE = path.join(__dirname, ".eval-baseline.json");
const REGRESSION_THRESHOLDS = {
  overall_accuracy: { critical: -0.10, warning: -0.05 },
  facet_correlation: { critical: -0.15, warning: -0.08 },
  facet_coverage: { critical: -0.10, warning: -0.05 },
};

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

async function calculateCurrentMetrics(): Promise<BaselineMetrics> {
  const allPairs = Object.values(groundTruth.pairs).flat();
  const facets: FacetType[] = ["aesthetic", "atmosphere", "mechanics", "narrative"];
  
  const results: Array<{
    expected: string;
    facet_similarities: Record<FacetType, number | null>;
    avg_similarity: number;
    pass: boolean;
  }> = [];

  for (const pair of allPairs) {
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

    results.push({
      expected: pair.expected_similarity,
      facet_similarities,
      avg_similarity,
      pass,
    });
  }

  const overall_accuracy = results.filter(r => r.pass).length / results.length;

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

  const threshold_analysis: any = {};
  for (const level of ["very_high", "high", "moderate", "low"]) {
    const levelResults = results.filter(r => r.expected === level);
    const sims = levelResults.map(r => r.avg_similarity);
    threshold_analysis[level] = {
      avg: sims.reduce((a, b) => a + b, 0) / sims.length || 0,
      min: Math.min(...sims),
      max: Math.max(...sims),
      count: sims.length,
    };
  }

  return {
    timestamp: new Date().toISOString(),
    overall_accuracy,
    by_facet,
    threshold_analysis,
  };
}

function loadBaseline(): BaselineMetrics | null {
  if (!fs.existsSync(BASELINE_FILE)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(BASELINE_FILE, "utf-8"));
}

function saveBaseline(metrics: BaselineMetrics): void {
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(metrics, null, 2));
}

function detectRegressions(baseline: BaselineMetrics, current: BaselineMetrics): RegressionResult {
  const regressions: RegressionResult["regressions"] = [];
  const improvements: RegressionResult["improvements"] = [];

  const accuracyChange = current.overall_accuracy - baseline.overall_accuracy;
  if (accuracyChange < REGRESSION_THRESHOLDS.overall_accuracy.critical) {
    regressions.push({
      metric: "Overall Accuracy",
      baseline: baseline.overall_accuracy,
      current: current.overall_accuracy,
      change: accuracyChange,
      severity: "critical",
    });
  } else if (accuracyChange < REGRESSION_THRESHOLDS.overall_accuracy.warning) {
    regressions.push({
      metric: "Overall Accuracy",
      baseline: baseline.overall_accuracy,
      current: current.overall_accuracy,
      change: accuracyChange,
      severity: "warning",
    });
  } else if (accuracyChange > 0.02) {
    improvements.push({
      metric: "Overall Accuracy",
      baseline: baseline.overall_accuracy,
      current: current.overall_accuracy,
      change: accuracyChange,
    });
  }

  for (const facet of ["aesthetic", "atmosphere", "mechanics", "narrative"] as FacetType[]) {
    const baselineCorr = baseline.by_facet[facet].correlation_with_expected;
    const currentCorr = current.by_facet[facet].correlation_with_expected;
    const corrChange = currentCorr - baselineCorr;

    if (corrChange < REGRESSION_THRESHOLDS.facet_correlation.critical) {
      regressions.push({
        metric: `${facet} correlation`,
        baseline: baselineCorr,
        current: currentCorr,
        change: corrChange,
        severity: "critical",
      });
    } else if (corrChange < REGRESSION_THRESHOLDS.facet_correlation.warning) {
      regressions.push({
        metric: `${facet} correlation`,
        baseline: baselineCorr,
        current: currentCorr,
        change: corrChange,
        severity: "warning",
      });
    } else if (corrChange > 0.05) {
      improvements.push({
        metric: `${facet} correlation`,
        baseline: baselineCorr,
        current: currentCorr,
        change: corrChange,
      });
    }

    const baselineCov = baseline.by_facet[facet].coverage;
    const currentCov = current.by_facet[facet].coverage;
    const covChange = currentCov - baselineCov;

    if (covChange < REGRESSION_THRESHOLDS.facet_coverage.critical) {
      regressions.push({
        metric: `${facet} coverage`,
        baseline: baselineCov,
        current: currentCov,
        change: covChange,
        severity: "critical",
      });
    } else if (covChange < REGRESSION_THRESHOLDS.facet_coverage.warning) {
      regressions.push({
        metric: `${facet} coverage`,
        baseline: baselineCov,
        current: currentCov,
        change: covChange,
        severity: "warning",
      });
    }
  }

  return {
    has_regression: regressions.length > 0,
    regressions,
    improvements,
  };
}

async function main() {
  const mode = process.argv[2] || "check";

  console.log("=".repeat(80));
  console.log("REGRESSION TEST SUITE");
  console.log("=".repeat(80));
  console.log();

  const current = await calculateCurrentMetrics();

  if (mode === "baseline") {
    saveBaseline(current);
    console.log("✓ Baseline saved successfully");
    console.log();
    console.log("Baseline metrics:");
    console.log(`  Overall accuracy: ${(current.overall_accuracy * 100).toFixed(1)}%`);
    console.log(`  Facet correlations:`);
    for (const [facet, stats] of Object.entries(current.by_facet)) {
      console.log(`    ${facet}: ${stats.correlation_with_expected.toFixed(3)}`);
    }
    console.log();
    console.log("Run 'npm run eval:regression' to check for regressions");
    return;
  }

  const baseline = loadBaseline();
  if (!baseline) {
    console.log("⚠️  No baseline found. Run with 'baseline' argument to create one:");
    console.log("   npx tsx scripts/eval-regression.ts baseline");
    console.log();
    console.log("Current metrics (not compared):");
    console.log(`  Overall accuracy: ${(current.overall_accuracy * 100).toFixed(1)}%`);
    console.log(`  Facet correlations:`);
    for (const [facet, stats] of Object.entries(current.by_facet)) {
      console.log(`    ${facet}: ${stats.correlation_with_expected.toFixed(3)}`);
    }
    return;
  }

  const result = detectRegressions(baseline, current);

  console.log(`Baseline: ${baseline.timestamp}`);
  console.log(`Current:  ${current.timestamp}`);
  console.log();

  if (!result.has_regression && result.improvements.length === 0) {
    console.log("✓ No regressions detected. Metrics unchanged.");
    return;
  }

  if (result.regressions.length > 0) {
    console.log("❌ REGRESSIONS DETECTED");
    console.log();
    
    const critical = result.regressions.filter(r => r.severity === "critical");
    const warnings = result.regressions.filter(r => r.severity === "warning");
    
    if (critical.length > 0) {
      console.log("🔴 CRITICAL REGRESSIONS:");
      for (const reg of critical) {
        console.log(`  ${reg.metric}:`);
        console.log(`    Baseline: ${(reg.baseline * 100).toFixed(1)}%`);
        console.log(`    Current:  ${(reg.current * 100).toFixed(1)}%`);
        console.log(`    Change:   ${(reg.change * 100).toFixed(1)}%`);
      }
      console.log();
    }
    
    if (warnings.length > 0) {
      console.log("⚠️  WARNINGS:");
      for (const reg of warnings) {
        console.log(`  ${reg.metric}:`);
        console.log(`    Baseline: ${(reg.baseline * 100).toFixed(1)}%`);
        console.log(`    Current:  ${(reg.current * 100).toFixed(1)}%`);
        console.log(`    Change:   ${(reg.change * 100).toFixed(1)}%`);
      }
      console.log();
    }
  }

  if (result.improvements.length > 0) {
    console.log("✅ IMPROVEMENTS:");
    for (const imp of result.improvements) {
      console.log(`  ${imp.metric}:`);
      console.log(`    Baseline: ${(imp.baseline * 100).toFixed(1)}%`);
      console.log(`    Current:  ${(imp.current * 100).toFixed(1)}%`);
      console.log(`    Change:   +${(imp.change * 100).toFixed(1)}%`);
    }
    console.log();
  }

  if (result.has_regression) {
    console.log("=".repeat(80));
    console.log("To update baseline (if regressions are acceptable):");
    console.log("  npx tsx scripts/eval-regression.ts baseline");
    console.log("=".repeat(80));
    process.exit(1);
  }
}

main().catch(console.error);
