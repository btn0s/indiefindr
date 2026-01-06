"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

const IS_DEV = process.env.NODE_ENV === "development";

interface RefreshSuggestionsButtonProps {
  appid: string;
}

/**
 * @deprecated This UX is being phased out.
 *
 * This was originally intended to be a "load more" control (append/mix in more
 * recommendations) and will be reintroduced at the *bottom* of the suggestions
 * list once that flow is designed. For now, suggestions auto-generate/stream.
 */
export function RefreshSuggestionsButton({
  appid,
}: RefreshSuggestionsButtonProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async (force = false) => {
    setRefreshing(true);
    setError(null);

    try {
      const url = force
        ? `/api/games/${appid}/suggestions/refresh?force=true`
        : `/api/games/${appid}/suggestions/refresh`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      // Check if response is OK and is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        throw new Error(
          `Server returned ${response.status}: ${text.substring(0, 100)}`
        );
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to refresh suggestions");
      }

      // Refresh the page to show updated suggestions
      router.refresh();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      console.error("Refresh suggestions error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={() => handleRefresh(false)}
        disabled={refreshing}
        variant="outline"
        size="sm"
      >
        {refreshing ? "Refreshing..." : "Refresh"}
        <RotateCcw
          className={`size-3 text-muted-foreground ${
            refreshing ? "animate-spin" : ""
          }`}
        />
      </Button>
      {IS_DEV && (
        <Button
          onClick={() => handleRefresh(true)}
          disabled={refreshing}
          variant="destructive"
          size="sm"
          title="Force regenerate (clears existing suggestions)"
        >
          Force refresh
          <RotateCcw className={`size-3 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      )}
      {error && (
        <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
