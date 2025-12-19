"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DialogClose } from "@/components/ui/dialog";

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

    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl: steamUrl.trim() }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to ingest game");
      }

      setSteamUrl("");
      onSuccess?.();

      // Navigate immediately to the game detail page
      if (data.appid) {
        router.push(`/games/${data.appid}`);
      } else {
        // Fallback: refresh the page to show updated games list
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setLoading(false);
    }
    // Note: Don't set loading to false here if navigating, as the component will unmount
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
