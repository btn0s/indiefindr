import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { gamesTable } from "@/db/schema";
import { desc } from "drizzle-orm";
import { GameSelectionGrid } from "@/components/onboarding/game-selection-grid";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { SteamRawData } from "@/types/steam";
import { completeOnboardingAndRedirect } from "@/app/(api)/actions/onboarding";

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
      id: gamesTable.id,
      title: gamesTable.title,
      steamAppid: gamesTable.steamAppid,
      descriptionShort: gamesTable.descriptionShort,
      rawData: gamesTable.rawData,
      tags: gamesTable.tags,
    })
    .from(gamesTable)
    .orderBy(desc(gamesTable.createdAt))
    .limit(12);

  // Cast the games to the correct type
  const typedGames = games.map((game) => ({
    ...game,
    rawData: game.rawData as SteamRawData | null,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-lg p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Pick Some Games</h2>
        <p className="text-muted-foreground mb-6">
          Select a few games that interest you. This will help us personalize
          your feed.
        </p>

        <GameSelectionGrid games={typedGames} />

        <div className="mt-8 flex justify-between">
          <Button variant="outline" asChild>
            <Link href="/onboarding">Back</Link>
          </Button>
          <form action={completeOnboardingAndRedirect}>
            <Button type="submit">Go to Feed</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
