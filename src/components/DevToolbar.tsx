"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";

/**
 * Dev toolbar that only shows on game pages.
 * Detects if we're on a /games/[appid] route and shows rerun suggestions button.
 */
export function DevToolbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  const isDev = process.env.NODE_ENV === "development";
  
  if (!mounted || !isDev) {
    return null;
  }
  
  const gamePageMatch = pathname?.match(/^\/games\/(\d+)$/);
  const appid = gamePageMatch ? parseInt(gamePageMatch[1], 10) : null;

  if (!appid || isNaN(appid)) {
    return null;
  }

  const handleRefreshSuggestions = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/games/${appid}/suggestions/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to refresh suggestions");
      }

      toast.success("Suggestions refreshed successfully", {
        description: `Added ${data.newCount} new suggestions`,
      });

      router.refresh();
    } catch (err) {
      toast.error("Failed to refresh suggestions", {
        description: err instanceof Error ? err.message : "Unknown error occurred",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 rounded-lg border border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4 py-2 shadow-lg">
      <Button
        onClick={handleRefreshSuggestions}
        disabled={refreshing}
        size="sm"
        variant="outline"
      >
        <RotateCcw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing..." : "Rerun Suggestions"}
      </Button>
    </div>
  );
}
