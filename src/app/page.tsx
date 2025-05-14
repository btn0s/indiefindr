import React from "react";
import { createClient } from "@/utils/supabase/server";
import { Feed } from "@/components/feed";
import { db } from "@/db";
import { profilesTable, libraryTable, externalSourceTable } from "@/db/schema";
import { eq, count } from "drizzle-orm";
import { ProfileMiniCard } from "@/components/profile-mini-card";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoggedIn = !!user;
  let userProfile = null;
  let libraryCount = 0;
  let findsCount = 0;

  if (isLoggedIn && user) {
    // Fetch user profile data
    const profileResult = await db
      .select({
        username: profilesTable.username,
        avatarUrl: profilesTable.avatarUrl,
        bio: profilesTable.bio,
        fullName: profilesTable.fullName,
      })
      .from(profilesTable)
      .where(eq(profilesTable.id, user.id))
      .limit(1);

    if (profileResult.length > 0) {
      userProfile = profileResult[0];
    }

    // Fetch library count
    const libraryCountResult = await db
      .select({ value: count() })
      .from(libraryTable)
      .where(eq(libraryTable.userId, user.id));
    if (libraryCountResult.length > 0) {
      libraryCount = libraryCountResult[0].value;
    }

    // Fetch finds count
    const findsCountResult = await db
      .select({ value: count() })
      .from(externalSourceTable)
      .where(eq(externalSourceTable.foundBy, user.id)); // Ensure foundBy stores the user ID
    if (findsCountResult.length > 0) {
      findsCount = findsCountResult[0].value;
    }
  }

  return (
    <main className="mx-auto py-8">
      {!isLoggedIn && (
        <section className="mb-12 py-12 text-center md:py-16 lg:py-20">
          <div className="container px-4 md:px-6">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none">
              Discover Your Next Favorite Indie Game
            </h1>
            <p className="mx-auto mt-4 max-w-[700px] text-lg text-muted-foreground md:text-xl">
              A simple, personalized way to discover and play unique indie games
              you'll love.
            </p>
          </div>
        </section>
      )}

      {/* Layout for Profile Card and Feed */}
      <div className="flex flex-col items-start md:flex-row">
        {/* Profile Card Section (Left Side) - Using the new component */}
        {/* <aside className="w-1/4 relative">
          {isLoggedIn && (
            <ProfileMiniCard
              isLoggedIn={isLoggedIn}
              userProfile={userProfile}
              libraryCount={libraryCount}
              findsCount={findsCount}
            />
          )}
        </aside> */}

        {/* Feed Section (Right Side or Main Area on Mobile) */}
        <section className="w-full">
          <Feed isLoggedIn={isLoggedIn} />
        </section>

        {/* <aside className="w-1/4"></aside> */}
      </div>
    </main>
  );
}
