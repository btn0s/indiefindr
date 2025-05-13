import React from "react";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { externalSourceTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import { GameSelectionGrid } from "@/components/onboarding/game-selection-grid";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { SteamRawData } from "@/types/steam";

export default async function OnboardingGamesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Fetch a selection of popular and recent games for the user to choose from
  const games = await db
    .select({
      id: externalSourceTable.id,
      title: externalSourceTable.title,
      steamAppid: externalSourceTable.steamAppid,
      descriptionShort: externalSourceTable.descriptionShort,
      rawData: externalSourceTable.rawData,
      tags: externalSourceTable.tags,
    })
    .from(externalSourceTable)
    .orderBy(desc(externalSourceTable.createdAt))
    .limit(12);

  // Cast the games to the correct type
  const typedGames = games.map(game => ({
    ...game,
    rawData: game.rawData as SteamRawData | null
  }));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Pick Some Games</h2>
        <p className="text-muted-foreground mb-6">
          Select a few games that interest you. This will help us personalize your feed.
        </p>

        <GameSelectionGrid games={typedGames} />

        <div className="mt-8 flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/onboarding">Back</Link>
          </Button>
          <Button asChild>
            <Link href="/">Go to Feed</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
