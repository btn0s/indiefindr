import "dotenv/config";
import { getSupabaseServiceClient } from "../src/lib/supabase/service";
import { sanitizeExplanation } from "../src/lib/suggest";
import { Suggestion } from "../src/lib/supabase/types";

const PAGE_SIZE = 100;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes("--apply");
  const limitArg = args.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? parseInt(limitArg.split("=")[1], 10) : null;

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made");
  } else {
    console.log("⚠️  APPLY MODE - Changes will be written to database");
  }

  const supabase = getSupabaseServiceClient();

  // Count total games with suggestions
  const { count: totalCount } = await supabase
    .from("games_new")
    .select("*", { count: "exact", head: true })
    .not("suggested_game_appids", "is", null);

  console.log(`\n📊 Found ${totalCount} games with suggestions`);

  let processed = 0;
  let updated = 0;
  let totalSuggestionsFixed = 0;
  let offset = 0;
  const maxProcess = limit || totalCount || 0;

  while (processed < maxProcess) {
    const { data: games, error } = await supabase
      .from("games_new")
      .select("appid, title, suggested_game_appids")
      .not("suggested_game_appids", "is", null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error("❌ Error fetching games:", error);
      break;
    }

    if (!games || games.length === 0) {
      break;
    }

    for (const game of games) {
      if (processed >= maxProcess) break;

      const suggestions: Suggestion[] = game.suggested_game_appids || [];
      if (suggestions.length === 0) continue;

      // Sanitize each suggestion's explanation
      const sanitized = suggestions.map((s) => ({
        ...s,
        explanation: sanitizeExplanation(s.explanation),
      }));

      // Check if any explanations changed
      const changed = suggestions.some(
        (s, i) => s.explanation !== sanitized[i].explanation
      );

      if (changed) {
        const fixedCount = suggestions.filter(
          (s, i) => s.explanation !== sanitized[i].explanation
        ).length;

        if (dryRun) {
          console.log(
            `  📝 ${game.appid} (${game.title}): Would fix ${fixedCount} explanation(s)`
          );
        } else {
          const { error: updateError } = await supabase
            .from("games_new")
            .update({
              suggested_game_appids: sanitized,
              updated_at: new Date().toISOString(),
            })
            .eq("appid", game.appid);

          if (updateError) {
            console.error(
              `  ❌ Failed to update ${game.appid}:`,
              updateError.message
            );
          } else {
            console.log(
              `  ✅ ${game.appid} (${game.title}): Fixed ${fixedCount} explanation(s)`
            );
          }
        }

        updated++;
        totalSuggestionsFixed += fixedCount;
      }

      processed++;
    }

    offset += PAGE_SIZE;

    if (processed % 500 === 0) {
      console.log(`\n📈 Progress: ${processed}/${maxProcess} processed`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total games processed: ${processed}`);
  console.log(`Games with fixed explanations: ${updated}`);
  console.log(`Total explanations fixed: ${totalSuggestionsFixed}`);

  if (dryRun) {
    console.log(
      "\n💡 Run with --apply flag to apply these changes to the database"
    );
  } else {
    console.log("\n✅ Repair complete!");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
