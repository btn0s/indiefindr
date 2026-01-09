import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(__dirname, "../../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { generateText, embed } from "ai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const VIBE_SUMMARY_PROMPT = `Analyze this game and create a SPECIFIC profile. Be concrete, not abstract.

Title: {title}
Description: {description}
Tags: {tags}

Output these fields in this exact format (one line each, no extra text):
PERSPECTIVE: (first-person, third-person, top-down, side-scroller, isometric, etc.)
TONE: (horror, cozy, tense, comedic, melancholic, nihilistic, whimsical, etc.)
PACING: (slow-burn, frantic, methodical, relaxed, etc.)
AESTHETIC: (lo-fi, pixel art, realistic, stylized, PS1, hand-drawn, etc.)
CORE_LOOP: (exploration, survival, puzzle, combat, management, narrative, etc.)
FANTASY: (one sentence - what does the player GET TO DO/BE?)

Be specific. "Atmospheric" is useless. "Claustrophobic dread in confined spaces" is useful.`;

type GameRow = {
  appid: number;
  title: string;
  short_description: string | null;
  steamspy_tags: Record<string, number> | null;
};

async function generateVibeSummary(game: GameRow): Promise<string> {
  const { text } = await generateText({
    model: "openai/gpt-4.1-mini",
    prompt: VIBE_SUMMARY_PROMPT
      .replace("{title}", game.title)
      .replace("{description}", game.short_description || "None")
      .replace("{tags}", game.steamspy_tags ? Object.keys(game.steamspy_tags).slice(0, 8).join(", ") : "None"),
  });
  return text;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: "openai/text-embedding-3-small",
    value: text,
  });
  return embedding;
}

async function ensureTable() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS game_vibes (
        appid INTEGER PRIMARY KEY REFERENCES games_new(appid),
        vibe_summary TEXT NOT NULL,
        vibe_embedding vector(1536),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS game_vibes_embedding_idx ON game_vibes 
        USING ivfflat (vibe_embedding vector_cosine_ops) WITH (lists = 100);
    `
  });
  
  if (error) {
    console.log("Table might already exist or RPC not available, trying direct insert...");
  }
}

async function main() {
  const batchSize = 10;
  const delayMs = 1000;

  console.log("Fetching games without vibe summaries...\n");

  const { data: existingVibes } = await supabase
    .from("game_vibes")
    .select("appid");
  
  const existingAppids = new Set((existingVibes || []).map(v => v.appid));

  const { data: games, error } = await supabase
    .from("games_new")
    .select("appid, title, short_description, steamspy_tags")
    .not("short_description", "is", null)
    .order("appid");

  if (error || !games) {
    console.error("Failed to fetch games:", error);
    return;
  }

  const gamesToProcess = games.filter(g => !existingAppids.has(g.appid));
  console.log(`Found ${gamesToProcess.length} games to process (${existingAppids.size} already done)\n`);

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < gamesToProcess.length; i += batchSize) {
    const batch = gamesToProcess.slice(i, i + batchSize);
    
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(gamesToProcess.length / batchSize)}`);

    const results = await Promise.allSettled(
      batch.map(async (game) => {
        const summary = await generateVibeSummary(game);
        const embedding = await generateEmbedding(summary);
        return { appid: game.appid, title: game.title, summary, embedding };
      })
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        const { appid, title, summary, embedding } = result.value;
        
        const { error: insertError } = await supabase
          .from("game_vibes")
          .upsert({
            appid,
            vibe_summary: summary,
            vibe_embedding: embedding,
          });

        if (insertError) {
          console.log(`  ✗ ${title}: ${insertError.message}`);
          failed++;
        } else {
          console.log(`  ✓ ${title}`);
          processed++;
        }
      } else {
        failed++;
        console.log(`  ✗ Failed: ${result.reason}`);
      }
    }

    if (i + batchSize < gamesToProcess.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Done! Processed: ${processed}, Failed: ${failed}`);
}

main().catch(console.error);
