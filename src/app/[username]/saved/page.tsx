import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUsername } from "@/lib/actions/profiles";
import { getDefaultSavedList, getSavedListGamesData } from "@/lib/actions/saved-lists";
import { GameCardAsync } from "@/components/GameCardAsync";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) {
    return { title: "User Not Found" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/@${username}/saved`;

  return {
    title: `${profile.display_name || username}'s Saved Games — IndieFindr`,
    description: `View ${profile.display_name || username}'s saved games on IndieFindr`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${profile.display_name || username}'s Saved Games — IndieFindr`,
      description: `View ${profile.display_name || username}'s saved games on IndieFindr`,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${profile.display_name || username}'s Saved Games — IndieFindr`,
      description: `View ${profile.display_name || username}'s saved games on IndieFindr`,
    },
  };
}

export default async function UserSavedPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username.toLowerCase());

  if (!profile) {
    notFound();
  }

  const list = await getDefaultSavedList(profile.id);
  if (!list || !list.is_public) {
    notFound();
  }

  const games = await getSavedListGamesData(list.id);

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">
            {profile.display_name || `@${username}`}&apos;s Saved Games
          </h1>
          <p className="text-sm text-muted-foreground">
            {games.length === 0
              ? "No saved games yet"
              : `${games.length} saved ${games.length === 1 ? "game" : "games"}`}
          </p>
        </div>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            This list doesn&apos;t have any games yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map((game) => (
            <GameCardAsync key={game.appid} appid={game.appid} />
          ))}
        </div>
      )}
    </main>
  );
}
