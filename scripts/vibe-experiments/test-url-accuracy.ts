import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { generateText } from "ai";

const TEST_GAMES = [
  "Mouthwashing",
  "Go Ape Ship", 
  "Hades",
  "Celeste",
  "Hollow Knight",
];

type UrlResult = {
  claimed_title: string;
  url: string;
  appid: string | null;
  actual_title: string | null;
  valid: boolean;
  title_match: boolean;
};

async function extractAppId(url: string): Promise<string | null> {
  const match = url.match(/store\.steampowered\.com\/app\/(\d+)/);
  return match ? match[1] : null;
}

async function verifyUrl(url: string): Promise<{ title: string | null; valid: boolean }> {
  const appid = await extractAppId(url);
  if (!appid) return { title: null, valid: false };

  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appid}`,
      { headers: { "Accept-Language": "en-US" } }
    );
    const data = await res.json();
    
    if (data[appid]?.success) {
      return { title: data[appid].data.name, valid: true };
    }
    return { title: null, valid: false };
  } catch {
    return { title: null, valid: false };
  }
}

function titlesSimilar(claimed: string, actual: string): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const c = normalize(claimed);
  const a = normalize(actual);
  return c === a || c.includes(a) || a.includes(c);
}

async function testGame(game: string): Promise<UrlResult[]> {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`TESTING: ${game}`);
  console.log(`${"─".repeat(60)}`);

  const { text } = await generateText({
    model: "perplexity/sonar",
    prompt: `Find 5 indie games similar to "${game}". For each game provide the Steam store URL.

Output format (one per line, no extra text):
Game Name - https://store.steampowered.com/app/XXXXX
Game Name - https://store.steampowered.com/app/XXXXX
...`,
  });

  console.log(`\nRaw output:\n${text}\n`);

  const lines = text.split("\n").filter(l => l.includes("store.steampowered.com"));
  const results: UrlResult[] = [];

  for (const line of lines.slice(0, 5)) {
    const urlMatch = line.match(/(https?:\/\/store\.steampowered\.com\/app\/\d+[^\s\)]*)/);
    const titleMatch = line.match(/^\d*\.?\s*\*?\*?([^-–—\[]+)/);
    
    if (!urlMatch) continue;

    const url = urlMatch[1].replace(/\/$/, "");
    const claimed_title = titleMatch ? titleMatch[1].replace(/\*+/g, "").trim() : "Unknown";
    const appid = await extractAppId(url);
    const { title: actual_title, valid } = await verifyUrl(url);
    const title_match = valid && actual_title ? titlesSimilar(claimed_title, actual_title) : false;

    results.push({
      claimed_title,
      url,
      appid,
      actual_title,
      valid,
      title_match,
    });

    const status = !valid ? "✗ INVALID" : !title_match ? "⚠ MISMATCH" : "✓ OK";
    console.log(`${status}: "${claimed_title}" → ${actual_title || "N/A"} (${appid})`);
  }

  return results;
}

async function main() {
  console.log("=".repeat(60));
  console.log("URL ACCURACY TEST");
  console.log("=".repeat(60));

  const allResults: UrlResult[] = [];

  for (const game of TEST_GAMES) {
    const results = await testGame(game);
    allResults.push(...results);
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log("SUMMARY");
  console.log("=".repeat(60));

  const total = allResults.length;
  const valid = allResults.filter(r => r.valid).length;
  const titleMatch = allResults.filter(r => r.title_match).length;

  console.log(`Total URLs: ${total}`);
  console.log(`Valid URLs: ${valid} (${Math.round(valid/total*100)}%)`);
  console.log(`Title matches: ${titleMatch} (${Math.round(titleMatch/total*100)}%)`);

  const mismatches = allResults.filter(r => r.valid && !r.title_match);
  if (mismatches.length > 0) {
    console.log(`\nMismatches:`);
    for (const r of mismatches) {
      console.log(`  "${r.claimed_title}" → actual: "${r.actual_title}"`);
    }
  }

  const invalid = allResults.filter(r => !r.valid);
  if (invalid.length > 0) {
    console.log(`\nInvalid URLs:`);
    for (const r of invalid) {
      console.log(`  ${r.url}`);
    }
  }
}

main().catch(console.error);
