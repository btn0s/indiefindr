"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";
import { IngestingDialog } from "@/components/IngestingDialog";

interface IngestFormProps {
  onSuccess?: () => void;
}

/**
 * Parse Steam URL to extract AppID
 */
function parseSteamUrl(url: string): number | null {
  const normalizedUrl = url.trim();
  
  // Try to extract AppID from various Steam URL patterns
  const patterns = [
    /store\.steampowered\.com\/app\/(\d+)/i,
    /steamcommunity\.com\/app\/(\d+)/i,
    /\/app\/(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = normalizedUrl.match(pattern);
    if (match && match[1]) {
      const appId = parseInt(match[1], 10);
      if (!isNaN(appId) && appId > 0) {
        return appId;
      }
    }
  }

  // If URL is just a number, treat it as AppID
  const numericMatch = normalizedUrl.match(/^\d+$/);
  if (numericMatch) {
    return parseInt(numericMatch[0], 10);
  }

  return null;
}

export function IngestForm({ onSuccess }: IngestFormProps) {
  const router = useRouter();
  const [steamUrl, setSteamUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ingestingGame, setIngestingGame] = useState<{
    title?: string;
    image?: string | null;
  } | null>(null);

  const handleIngest = async () => {
    if (!steamUrl.trim()) {
      setError("Please enter a Steam URL");
      return;
    }

    setLoading(true);
    setError(null);

    // Parse the appId first
    const appId = parseSteamUrl(steamUrl.trim());
    
    if (!appId) {
      setError("Invalid Steam URL");
      setLoading(false);
      return;
    }

    try {
      // Check if the game already exists
      const checkResponse = await fetch(`/api/games/${appId}`);
      if (checkResponse.ok) {
        // Game exists, redirect immediately
        setSteamUrl("");
        onSuccess?.();
        router.push(`/games/${appId}`);
        return;
      }

      // Game doesn't exist, show loading dialog and navigate immediately
      setIngestingGame({ title: "Loading game info...", image: null });

      // Start ingestion in background (don't await full response)
      fetch("/api/games/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl: steamUrl.trim() }),
      })
        .then((response) => response.json())
        .catch((error) => {
          console.error("Error ingesting game:", error);
        })
        .finally(() => {
          setIngestingGame(null);
        });

      setSteamUrl("");
      onSuccess?.();

      // Navigate immediately - game page will fetch from Steam API if not in DB yet
      router.push(`/games/${appId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
      setIngestingGame(null);
    }
  };

  return (
    <>
      <IngestingDialog
        open={!!ingestingGame}
        gameTitle={ingestingGame?.title}
        gameImage={ingestingGame?.image}
      />
      <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
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
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <DialogClose>
          <Button variant="outline" disabled={loading}>
            Cancel
          </Button>
        </DialogClose>
        <Button onClick={handleIngest} disabled={loading}>
          {loading ? "Ingesting..." : "Ingest"}
        </Button>
      </div>
    </div>
    </>
  );
}
