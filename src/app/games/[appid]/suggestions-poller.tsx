"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SuggestionsPollerProps {
  appId: number;
}

export function SuggestionsPoller({ appId }: SuggestionsPollerProps) {
  const router = useRouter();
  const [isPolling, setIsPolling] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let elapsedInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      setIsPolling(true);
      setElapsed(0);
      setMessage(null);

      // Start elapsed timer
      elapsedInterval = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      // Poll for completion
      pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/suggestions?appid=${appId}`);
          if (!statusResponse.ok) {
            return;
          }

          const { done, status, error } = await statusResponse.json();

          if (done) {
            if (pollInterval) clearInterval(pollInterval);
            if (elapsedInterval) clearInterval(elapsedInterval);
            setIsPolling(false);
            router.refresh();
          } else if (status === "failed" && error) {
            if (pollInterval) clearInterval(pollInterval);
            if (elapsedInterval) clearInterval(elapsedInterval);
            setIsPolling(false);
            setMessage(error);
          }
        } catch (err) {
          console.error("Error polling suggestion status:", err);
        }
      }, 2000);
    };

    const enqueue = async () => {
      const response = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appid: appId }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        setMessage(error?.error || "Failed to start suggestion generation");
        return;
      }

      startPolling();
    };

    const initialize = async () => {
      try {
        // Check if job exists already
        const statusResponse = await fetch(`/api/suggestions?appid=${appId}`);
        if (statusResponse.ok) {
          const { done, status, error, hasSuggestions } =
            await statusResponse.json();

          // Suggestions already present: nothing to do.
          if (hasSuggestions) {
            return;
          }

          // Job in progress: start polling.
          if (!done && (status === "queued" || status === "running")) {
            startPolling();
            return;
          }

          // Job finished but produced no rows in `game_suggestions`.
          // Don't auto-requeue forever—show a message and let user retry manually.
          if (done && status === "succeeded") {
            setMessage(error || "No suggestions found for this game yet.");
            return;
          }

          if (done && status === "failed") {
            setMessage(error || "Something went wrong generating suggestions.");
            return;
          }
        }

        // No job: enqueue a new one.
        await enqueue();
      } catch (error) {
        console.error("Error initializing suggestion generation:", error);
        setMessage("Something went wrong generating suggestions.");
      }
    };

    initialize();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (elapsedInterval) clearInterval(elapsedInterval);
    };
  }, [appId, router]);

  if (!isPolling) {
    return (
      <div className="flex flex-col items-center gap-4 py-8 w-full bg-muted p-4">
        <h2 className="text-xl font-semibold">
          {message ? message : "Generate suggestions?"}
        </h2>
        <Button
          type="button"
          onClick={async () => {
            setMessage(null);
            const response = await fetch("/api/suggestions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ appid: appId }),
            });
            if (!response.ok) {
              const err = await response.json().catch(() => null);
              setMessage(err?.error || "Failed to start suggestion generation");
              return;
            }
            // Begin polling once enqueued.
            setIsPolling(true);
            setElapsed(0);
          }}
        >
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        <span>Finding similar games...</span>
        <span className="tabular-nums">{elapsed}s</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i}>
            <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
            <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
            <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
