"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_ATTEMPTS = 60; // Stop after 2 minutes (60 * 2s)

export function GameProcessingState({ appid }: { appid: string }) {
  const router = useRouter();
  const pollAttemptsRef = useRef(0);
  const isPollingRef = useRef(false);

  useEffect(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

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
      isPollingRef.current = false;
    };

    void pollForGame();

    return () => {
      isPollingRef.current = false;
    };
  }, [appid, router]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Spinner className="size-5" />
          <CardTitle>Game is being processed</CardTitle>
        </div>
        <CardDescription>
          The game is still being added to the database. This may take a moment,
          especially if Steam&apos;s API is slow or rate-limited. The page will
          automatically update when ready.
        </CardDescription>
        <div className="pt-2">
          <Button
            variant="outline"
            onClick={() => router.refresh()}
            className="text-sm"
          >
            Refresh now
          </Button>
        </div>
      </CardHeader>
    </Card>
  );
}
