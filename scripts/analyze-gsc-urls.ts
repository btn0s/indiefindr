#!/usr/bin/env tsx
/**
 * Analyze Google Search Console URL exports to identify patterns
 * Usage: tsx scripts/analyze-gsc-urls.ts <path-to-csv>
 */

import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";

interface URLPattern {
  pattern: string;
  count: number;
  examples: string[];
}

function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    // Remove trailing slash
    path = path.replace(/\/$/, "");
    return path;
  } catch {
    return url;
  }
}

function extractPattern(path: string): string {
  // Extract numeric app IDs
  const numericMatch = path.match(/^\/(\d+)$/);
  if (numericMatch) return "/<number>";

  // Extract /find/<number>
  if (path.match(/^\/find\/\d+$/)) return "/find/<number>";

  // Extract /<number>/<slug>
  if (path.match(/^\/(\d+)\/[^/]+$/)) return "/<number>/<slug>";

  // Extract /user/<username>
  if (path.match(/^\/user\/[^/]+$/)) return "/user/<username>";

  // Extract /<username> (no prefix)
  if (path.match(/^\/[^/]+$/) && !path.startsWith("/api") && !path.startsWith("/games") && !path.startsWith("/collections")) {
    return "/<slug>";
  }

  return path;
}

function analyzeUrls(csvPath: string) {
  const content = readFileSync(csvPath, "utf-8");
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  }) as Array<{ URL: string; "Last crawled"?: string }>;

  const patterns = new Map<string, { count: number; examples: string[] }>();

  for (const record of records) {
    const url = record.URL;
    if (!url) continue;

    const path = normalizeUrl(url);
    const pattern = extractPattern(path);

    if (!patterns.has(pattern)) {
      patterns.set(pattern, { count: 0, examples: [] });
    }

    const entry = patterns.get(pattern)!;
    entry.count++;
    if (entry.examples.length < 3) {
      entry.examples.push(path);
    }
  }

  // Sort by count descending
  const sortedPatterns = Array.from(patterns.entries())
    .map(([pattern, data]) => ({
      pattern,
      count: data.count,
      examples: data.examples,
    }))
    .sort((a, b) => b.count - a.count);

  console.log("URL Pattern Analysis\n");
  console.log("=" .repeat(60));
  console.log(`Total URLs analyzed: ${records.length}\n`);

  for (const { pattern, count, examples } of sortedPatterns) {
    const percentage = ((count / records.length) * 100).toFixed(1);
    console.log(`${pattern}`);
    console.log(`  Count: ${count} (${percentage}%)`);
    console.log(`  Examples: ${examples.join(", ")}`);
    console.log();
  }

  return sortedPatterns;
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: tsx scripts/analyze-gsc-urls.ts <path-to-csv>");
  process.exit(1);
}

analyzeUrls(csvPath);
