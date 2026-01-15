import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getProfileByUserId } from "@/lib/actions/profiles";
import { GameCardAsync } from "@/components/GameCardAsync";
import { Button } from "@/components/ui/button";
import type { SavedList } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: list } = await supabase
    .from("saved_lists")
    .select("title, is_public")
    .eq("id", id)
    .maybeSingle();

  if (!list || !list.is_public) {
    return { title: "List Not Found" };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";
  const canonicalUrl = `${siteUrl}/lists/${id}`;

  return {
    title: `${list.title} — IndieFindr`,
    description: `View ${list.title} - a saved game list on IndieFindr`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${list.title} — IndieFindr`,
      description: `View ${list.title} - a saved game list on IndieFindr`,
      url: canonicalUrl,
      siteName: "IndieFindr",
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${list.title} — IndieFindr`,
      description: `View ${list.title} - a saved game list on IndieFindr`,
    },
  };
}

export default async function PublicListPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = getSupabaseServerClient();

  const { data: list, error: listError } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (listError || !list) {
    notFound();
  }

  if (!list.is_public) {
    notFound();
  }

  // Redirect to username-based URL if user has a username and this is their default list
  if (list.is_default) {
    const profile = await getProfileByUserId(list.owner_id);
    if (profile?.username) {
      redirect(`/@${profile.username}/saved`);
    }
  }

  const { data: savedGames, error: gamesError } = await supabase
    .from("saved_list_games")
    .select("appid")
    .eq("list_id", id)
    .order("created_at", { ascending: false });

  if (gamesError) {
    console.error("Error loading saved list games:", gamesError);
  }

  const gameAppids = savedGames?.map((g) => g.appid) || [];
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://www.indiefindr.gg";

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{list.title}</h1>
          <p className="text-sm text-muted-foreground">
            {gameAppids.length === 0
              ? "No games in this list"
              : `${gameAppids.length} ${gameAppids.length === 1 ? "game" : "games"}`}
          </p>
        </div>

        <div>
          <Link href="/">
            <Button variant="ghost" size="sm">
              ← Back to home
            </Button>
          </Link>
        </div>
      </div>

      {gameAppids.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            This list doesn&apos;t have any games yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {gameAppids.map((appid) => (
            <GameCardAsync key={appid} appid={appid} />
          ))}
        </div>
      )}
    </main>
  );
}
