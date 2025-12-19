"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface RefreshSuggestionsButtonProps {
  appid: string;
}

export function RefreshSuggestionsButton({
  appid,
}: RefreshSuggestionsButtonProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(`/api/games/${appid}/suggestions/refresh`, {
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
    <>
      <Button
        onClick={handleRefresh}
        disabled={refreshing}
        variant="outline"
        size="sm"
      >
        {refreshing ? "Loading..." : "Load more"}
        <Plus className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
      {error && (
        <div className="mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
    </>
  );
}
