import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RelatedGamesSection } from "@/components/RelatedGamesSection";
import { RerunButton } from "@/components/RerunButton";
import { ManualSimilarEditor } from "@/components/ManualSimilarEditor";
import { supabase } from "@/lib/supabase/server";
import type { Game } from "@/lib/supabase/types";
import { ArrowLeftIcon } from "lucide-react";

type ManualLink = {
  id: string;
  otherAppid: number;
  otherName: string;
  otherHeader: string | null;
  facets: string[];
  note: string | null;
};

async function getGame(appid: string): Promise<Game | null> {
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return null;
  }

  const { data: game, error } = await supabase
    .from("games")
    .select("*")
    .eq("id", appId)
    .single();

  if (error || !game) {
    return null;
  }

  return game;
}

async function getManualSimilarGames(appid: string): Promise<ManualLink[]> {
  const appId = parseInt(appid, 10);

  if (isNaN(appId)) {
    return [];
  }

  const { data, error } = await supabase
    .from("manual_similarities")
    .select(
      `
      id,
      source_appid,
      target_appid,
      facets,
      note,
      source:source_appid ( id, name, header_image ),
      target:target_appid ( id, name, header_image )
    `
    )
    .or(`source_appid.eq.${appId},target_appid.eq.${appId}`);

  if (error || !data) {
    console.error("Error fetching manual links:", error);
    return [];
  }

  return (data as any[]).map((row) => {
    const isSource = row.source_appid === appId;
    const other = isSource ? row.target : row.source;
    return {
      id: row.id,
      otherAppid: other?.id ?? (isSource ? row.target_appid : row.source_appid),
      otherName: other?.name ?? "Unknown game",
      otherHeader: other?.header_image ?? null,
      facets: row.facets ?? [],
      note: row.note ?? null,
    };
  });
}

export default async function GameDetailPage({
  params,
}: {
  params: Promise<{ appid: string }>;
}) {
  const { appid } = await params;
  const [game, manualLinks] = await Promise.all([
    getGame(appid),
    getManualSimilarGames(appid),
  ]);

  if (!game) {
    notFound();
  }

  const appIdNumber = parseInt(appid, 10);
  const tags = game.tags ? Object.keys(game.tags) : [];
  const isDev = process.env.NEXT_PUBLIC_ENV === "development";

  return (
    <div className="min-h-screen">
      <main className="container mx-auto max-w-4xl px-4 py-8 flex flex-col gap-4">
        <div className="flex items-center justify-between relative">
          <Link href="/">
            <Button variant="ghost">
              <ArrowLeftIcon className="size-4" /> Back to Home
            </Button>
          </Link>
          <div className="relative">
            <RerunButton appid={appid} />
          </div>
        </div>

        <h1 className="text-2xl font-semibold">Games like {game.name}</h1>

        {/* Game Header */}
        <div className="flex gap-4">
          {game.header_image && (
            <Image
              src={game.header_image}
              alt={game.name}
              width={460}
              height={215}
              className="aspect-video w-1/3 object-cover rounded-lg"
              unoptimized
            />
          )}
          <div className="flex-1 flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div>{game.name}</div>
              <a
                href={`https://store.steampowered.com/app/${appid}/`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline text-xs"
              >
                View on Steam
              </a>
            </div>
            {game.description && (
              <p className="text-muted-foreground line-clamp-4 text-xs">
                {game.description.replace(/<[^>]*>/g, "").substring(0, 300)}
                {game.description.length > 300 ? "..." : ""}
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.slice(0, 10).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {isDev && (
          <ManualSimilarEditor
            appid={appIdNumber}
            existingLinks={manualLinks}
          />
        )}

        {/* Related Games by Facet */}
        <RelatedGamesSection appid={appid} />
      </main>
    </div>
  );
}
