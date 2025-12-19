"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IS_DEV } from "@/lib/utils/dev";
import { RefreshCw } from "lucide-react";

interface RefreshSuggestionsButtonProps {
  appid: string;
}

export function RefreshSuggestionsButton({ appid }: RefreshSuggestionsButtonProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only show in dev mode
  if (!IS_DEV) {
    return null;
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${appid}/suggestions/refresh`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to refresh suggestions");
      }

      // Refresh the page to show updated suggestions
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <>
      <Button 
        onClick={handleRefresh} 
        disabled={refreshing} 
        variant="outline"
        size="sm"
      >
        <RefreshCw className={`size-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
        {refreshing ? "Refreshing..." : "Refresh Suggestions"}
      </Button>
      {error && (
        <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </>
  );
}
