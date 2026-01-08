"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 60; // Stop after 2 minutes (60 * 2s)
const RETRY_DELAYS_MS = [0, 10000, 30000, 60000]; // Immediately, then 10s, 30s, 60s

export function GameProcessingState({ appid }: { appid: string }) {
  const router = useRouter();
  const pollAttemptsRef = useRef(0);
  const isPollingRef = useRef(false);
  const submitAttemptsRef = useRef(0);
  const retryTimeoutsRef = useRef<NodeJS.Timeout[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const [isExhausted, setIsExhausted] = useState(false);

  const triggerIngestion = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/games/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamUrl: `https://store.steampowered.com/app/${appid}/`,
          skipSuggestions: true,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setLastError(null);
        return true;
      } else {
        const errorMsg =
          data.error || `HTTP ${response.status}: ${response.statusText}`;
        setLastError(errorMsg);
        return false;
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Failed to trigger ingestion";
      setLastError(errorMsg);
      return false;
    }
  }, [appid]);

  useEffect(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    // Trigger initial ingestion asynchronously to avoid setState in effect
    setTimeout(() => {
      void triggerIngestion();
    }, 0);
    submitAttemptsRef.current = 1;

    // Schedule retries with backoff
    RETRY_DELAYS_MS.slice(1).forEach((delay) => {
      const timeout = setTimeout(() => {
        if (pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
          submitAttemptsRef.current++;
          void triggerIngestion();
        }
      }, delay);
      retryTimeoutsRef.current.push(timeout);
    });

    const pollForGame = async () => {
      while (pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        try {
          const response = await fetch(`/api/games/${appid}`, {
            cache: "no-store",
          });

          if (response.ok) {
            // Game is now available, refresh the page to show it
            router.refresh();
            return;
          }
        } catch (error) {
          // Ignore errors and continue polling
          console.error("Error polling for game:", error);
        }

        pollAttemptsRef.current++;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      // Max attempts reached, stop polling
      setIsExhausted(true);
      isPollingRef.current = false;
    };

    void pollForGame();

    return () => {
      isPollingRef.current = false;
      retryTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      retryTimeoutsRef.current = [];
    };
  }, [appid, router, triggerIngestion]);

  const handleManualRetry = async () => {
    setLastError(null);
    setIsExhausted(false);
    pollAttemptsRef.current = 0;
    isPollingRef.current = true;
    submitAttemptsRef.current = 1;
    await triggerIngestion();

    // Restart polling
    const pollForGame = async () => {
      while (pollAttemptsRef.current < MAX_POLL_ATTEMPTS) {
        try {
          const response = await fetch(`/api/games/${appid}`, {
            cache: "no-store",
          });

          if (response.ok) {
            router.refresh();
            return;
          }
        } catch (error) {
          console.error("Error polling for game:", error);
        }

        pollAttemptsRef.current++;
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }

      setIsExhausted(true);
      isPollingRef.current = false;
    };

    void pollForGame();
  };

  const steamUrl = `https://store.steampowered.com/app/${appid}/`;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          {!isExhausted && <Spinner className="size-5" />}
          <CardTitle>
            {isExhausted
              ? "Game is still processing"
              : "Game is being processed"}
          </CardTitle>
        </div>
        <CardDescription>
          {isExhausted
            ? "The game hasn't been added to the database yet. This may take longer than expected, especially if Steam's API is slow or rate-limited."
            : "The game is still being added to the database. This may take a moment, especially if Steam's API is slow or rate-limited. The page will automatically update when ready."}
        </CardDescription>
        {lastError && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              Last ingestion attempt failed: {lastError}
            </AlertDescription>
          </Alert>
        )}
        <div className="pt-2 flex flex-wrap gap-2">
          {isExhausted && (
            <Button
              variant="default"
              onClick={handleManualRetry}
              className="text-sm"
            >
              Retry ingestion
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.refresh()}
            className="text-sm"
          >
            Refresh now
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(steamUrl, "_blank")}
            className="text-sm"
          >
            Open on Steam
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
