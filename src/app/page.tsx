"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type GameListItem = {
  id: number;
  name: string;
};

export default function Home() {
  const [steamUrl, setSteamUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [games, setGames] = useState<GameListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGames();
  }, []);

  const loadGames = async () => {
    try {
      const response = await fetch("/api/games");
      if (!response.ok) {
        throw new Error("Failed to load games");
      }
      const data = await response.json();
      setGames(data);
    } catch (err) {
      console.error("Error loading games:", err);
    }
  };

  const handleIngest = async () => {
    if (!steamUrl.trim()) {
      setError("Please enter a Steam URL");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/games/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl: steamUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to ingest game");
      }

      setSteamUrl("");
      await loadGames();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">Games Graph</h1>
          <p className="text-muted-foreground">
            Paste a Steam link to ingest game data and find similar games.
          </p>
        </div>

        <div className="mb-8">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="https://store.steampowered.com/app/123456/GameName/"
              value={steamUrl}
              onChange={(e) => setSteamUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !loading) {
                  handleIngest();
                }
              }}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleIngest} disabled={loading}>
              {loading ? "Ingesting..." : "Ingest"}
            </Button>
          </div>
          {error && <p className="text-destructive mt-2">{error}</p>}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">Ingested Games</h2>
          {games.length === 0 ? (
            <p className="text-muted-foreground">
              No games ingested yet. Start by ingesting a game above.
            </p>
          ) : (
            <ul className="space-y-1">
              {games.map((game) => (
                <li key={game.id}>
                  <Link
                    href={`/games/${game.id}`}
                    className="text-blue-600 hover:underline dark:text-blue-400"
                  >
                    {game.name} ({game.id})
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
