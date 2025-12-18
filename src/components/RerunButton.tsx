"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface RerunButtonProps {
  appid: string;
}

export function RerunButton({ appid }: RerunButtonProps) {
  const router = useRouter();
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);

  const handleRerun = async () => {
    setRerunning(true);
    setRerunError(null);

    try {
      const steamUrl = `https://store.steampowered.com/app/${appid}/`;

      const response = await fetch("/api/games/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steamUrl }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rerun ingestion");
      }

      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRerunning(false);
    }
  };

  return (
    <>
      <Button onClick={handleRerun} disabled={rerunning} variant="outline">
        {rerunning ? "Rerunning..." : "Rerun Ingestion"}
      </Button>
      {rerunError && (
        <div className="absolute top-full right-0 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md z-10">
          <p className="text-destructive text-sm">{rerunError}</p>
        </div>
      )}
    </>
  );
}
