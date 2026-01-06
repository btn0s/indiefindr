"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { IS_DEV } from "@/lib/utils/dev";
import { toast } from "sonner";
import { RefreshCwIcon } from "lucide-react";

interface DevControlBarProps {
  appid: number;
}

export function DevControlBar({ appid }: DevControlBarProps) {
  const [loading, setLoading] = useState(false);

  if (!IS_DEV) {
    return null;
  }

  const handleReingest = async () => {
    setLoading(true);
    try {
      const steamUrl = `https://store.steampowered.com/app/${appid}/`;
      const response = await fetch("/api/games/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl, skipSuggestions: false, force: true }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Failed to re-ingest game");
      }

      toast.success("Game re-ingested successfully", {
        description: `Refreshing page in 2 seconds...`,
      });

      // Refresh the page after a short delay to show updated data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      toast.error("Failed to re-ingest game", {
        description: err instanceof Error ? err.message : "Unknown error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 rounded-lg border border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 p-3 shadow-lg">
      <div className="text-xs font-semibold text-muted-foreground">Dev Controls</div>
      <Button
        onClick={handleReingest}
        disabled={loading}
        size="sm"
        variant="outline"
        className="w-full"
      >
        <RefreshCwIcon className={loading ? "animate-spin" : ""} />
        {loading ? "Re-ingesting..." : "Re-run Ingestion"}
      </Button>
    </div>
  );
}
