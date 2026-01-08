import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { getOrFetchGame } from "@/lib/actions/games";
import { generateSuggestions } from "@/lib/actions/suggestions";
import { GameVideo } from "@/components/GameVideo";
import { GameCardAsync } from "@/components/GameCardAsync";
import { SuggestionsLoader } from "./suggestions-loader";

type Suggestion = {
  suggested_appid: number;
  reason: string;
};

async function getSuggestions(appId: number): Promise<Suggestion[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase
    .from("game_suggestions")
    .select("suggested_appid, reason")
    .eq("source_appid", appId);

  return data ?? [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    return { title: "Game Not Found" };
  }

  const game = await getOrFetchGame(appId);

  if (!game) {
    return { title: "Game Not Found" };
  }

  const title = `Games like ${game.title}`;
  const description = game.short_description
    ? `Find games like ${game.title}. ${game.short_description}`
    : `Find games similar to ${game.title} on Steam.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
  };
}

export default async function GameNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const appId = parseInt(id, 10);

  if (isNaN(appId)) {
    notFound();
  }

  const game = await getOrFetchGame(appId);

  if (!game) {
    notFound();
  }

  const suggestions = await getSuggestions(appId);
  const hasSuggestions = suggestions.length > 0;

  async function generate() {
    "use server";
    await generateSuggestions(appId);
    revalidatePath(`/games-new/${appId}`);
  }

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-semibold">{game.title}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {game.developers.length > 0 && (
              <span>By {game.developers.join(", ")}</span>
            )}
            {game.release_date && <span>{game.release_date}</span>}
          </div>
        </div>
        {game.videos.length > 0 && (
          <div className="w-full aspect-video">
            <GameVideo
              videos={game.videos}
              headerImage={game.header_image}
              alt={game.title}
              className="w-full h-full"
              autoPlay
            />
          </div>
        )}
        {game.short_description && (
          <p className="text-muted-foreground">{game.short_description}</p>
        )}

        <a
          href={`https://store.steampowered.com/app/${appId}/`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-fit inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-primary-foreground bg-gradient-to-b from-primary/90 to-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),inset_0_-1px_0_0_rgba(0,0,0,0.2),0_1px_2px_rgba(0,0,0,0.2)] border border-primary/80 hover:from-primary hover:to-primary/90 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:translate-y-px transition-all"
        >
          View on Steam
          <ArrowUpRight className="size-4" />
        </a>
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="text-lg font-semibold">Games like {game.title}</h1>
        {hasSuggestions ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {suggestions.map((s) => (
              <GameCardAsync
                key={s.suggested_appid}
                appid={s.suggested_appid}
                explanation={s.reason}
              />
            ))}
          </div>
        ) : (
          <form action={generate}>
            <SuggestionsLoader autoSubmit />
          </form>
        )}
      </div>
    </main>
  );
}
