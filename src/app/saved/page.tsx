"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { GameCard } from "@/components/GameCard";
import type { GameCardGame } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Copy, Eye, EyeOff, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import type { Collection } from "@/lib/supabase/types";

export default function SavedPage() {
  const router = useRouter();
  const [list, setList] = useState<Collection | null>(null);
  const [games, setGames] = useState<GameCardGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const loadSavedList = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const supabase = getSupabaseBrowserClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        setUsername(profile?.username ?? null);

        const { data: defaultList, error: listError } = await supabase
          .from("collections")
          .select("*")
          .eq("owner_id", user.id)
          .eq("is_default", true)
          .maybeSingle();

        if (listError) {
          throw listError;
        }

        if (!defaultList) {
          setIsLoading(false);
          return;
        }

        setList(defaultList);

        const { data: savedGames, error: gamesError } = await supabase
          .from("collection_games")
          .select("appid")
          .eq("collection_id", defaultList.id)
          .order("created_at", { ascending: false });

        if (gamesError || !savedGames || savedGames.length === 0) {
          setGames([]);
          return;
        }

        const appIds = savedGames.map((g) => g.appid);

        const { data: gamesData, error: gamesDataError } = await supabase
          .from("games_new")
          .select("appid, title, header_image")
          .in("appid", appIds);

        if (gamesDataError || !gamesData) {
          setGames([]);
          return;
        }

        const gamesMap = new Map(gamesData.map((g) => [g.appid, g]));
        const ordered = appIds
          .map((id) => gamesMap.get(id))
          .filter((g): g is GameCardGame => g !== undefined);

        setGames(ordered);
      } catch (error) {
        console.error("Error loading saved list:", error);
        toast.error("Failed to load saved games");
      } finally {
        setIsLoading(false);
      }
    };

    loadSavedList();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleToggleVisibility = async () => {
    if (!list) return;

    setIsTogglingVisibility(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase
        .from("collections")
        .update({ is_public: !list.is_public })
        .eq("id", list.id)
        .eq("owner_id", user.id);

      if (error) {
        toast.error(error.message);
      } else {
        setList({ ...list, is_public: !list.is_public });
        toast.success(
          list.is_public
            ? "List is now private"
            : "List is now public and shareable"
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update visibility");
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleCopyShareLink = async () => {
    if (!list) return;

    let currentUsername = username;
    if (!currentUsername) {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();
        currentUsername = profile?.username ?? null;
        if (currentUsername) {
          setUsername(currentUsername);
        }
      }
    }

    if (!currentUsername) {
      toast.error("Please claim a username first to share your list");
      router.push("/settings");
      return;
    }

    const shareUrl = `${window.location.origin}/@${currentUsername}/saved`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-4xl py-6 sm:py-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading saved games...</p>
        </div>
      </main>
    );
  }

  if (!list) {
    return (
      <main className="container mx-auto max-w-4xl py-6 sm:py-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            No saved list found. Please try signing out and back in.
          </p>
          <Link href="/login">
            <Button variant="outline">Sign in</Button>
          </Link>
        </div>
      </main>
    );
  }

  const shareUrl = username
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/@${username}/saved`
    : null;

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{list.title}</h1>
          <p className="text-sm text-muted-foreground">
            {games.length === 0
              ? "No saved games yet"
              : `${games.length} saved ${games.length === 1 ? "game" : "games"}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={handleToggleVisibility}
            disabled={isTogglingVisibility}
          >
            {list.is_public ? (
              <>
                <Eye className="h-4 w-4" />
                Public
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                Private
              </>
            )}
          </Button>

          {list.is_public && (
            <>
              {!username ? (
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    Claim username to share
                  </Button>
                </Link>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCopyShareLink}>
                    <Copy className="h-4 w-4" />
                    Copy share link
                  </Button>
                  {shareUrl && (
                    <a
                      href={shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex"
                    >
                      <Button variant="ghost" size="sm">
                        <ExternalLink className="h-4 w-4" />
                        View public page
                      </Button>
                    </a>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Start your collection</h2>
            <p className="text-muted-foreground max-w-md">
              Find games you love and save them here. Click the bookmark icon on any game page to add it to your list.
            </p>
          </div>
          <Link href="/">
            <Button>Browse games</Button>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {games.map((game) => (
            <GameCard
              key={game.appid}
              appid={game.appid}
              title={game.title}
              header_image={game.header_image}
            />
          ))}
        </div>
      )}
    </main>
  );
}
