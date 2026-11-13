"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";
import { parseSteamUrl } from "@/lib/utils/parse-steam-url";

interface IngestFormProps {
  onSuccess?: () => void;
}

export function IngestForm({ onSuccess }: IngestFormProps) {
  const router = useRouter();
  const [steamUrl, setSteamUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        setLoading(false);
        onSuccess?.();
        router.push(`/games/${appId}`);
        return;
      }

      // Game doesn't exist, start ingestion and navigate immediately
      setLoading(false);
      setSteamUrl("");
      onSuccess?.();

      // Start ingestion in background (don't await)
      fetch("/api/games/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl: steamUrl.trim(), skipSuggestions: true }),
        keepalive: true,
      }).catch((error) => {
        console.error("Error ingesting game:", error);
      });

      // Navigate immediately - the game page will show loading state
      // and poll for data as it becomes available
      router.push(`/games/${appId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
    }
  };

  return (
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
  );
}
