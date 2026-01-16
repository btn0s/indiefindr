"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SuggestionsLoader } from "./suggestions-loader";

interface SuggestionsPollerProps {
  appId: number;
}

export function SuggestionsPoller({ appId }: SuggestionsPollerProps) {
  const router = useRouter();
  const [isPolling, setIsPolling] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let elapsedInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      setIsPolling(true);
      setElapsed(0);

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
            console.error("Suggestion generation failed:", error);
          }
        } catch (err) {
          console.error("Error polling suggestion status:", err);
        }
      }, 2000);
    };

    const initialize = async () => {
      try {
        // Check if job already exists and is running
        const statusResponse = await fetch(`/api/suggestions?appid=${appId}`);
        if (statusResponse.ok) {
          const { done, status } = await statusResponse.json();
          if (!done && (status === "queued" || status === "running")) {
            // Job already in progress, start polling
            startPolling();
            return;
          }
        }

        // No job in progress, start a new one
        const response = await fetch("/api/suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ appid: appId }),
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("Failed to start suggestion generation:", error);
          return;
        }

        // Start polling after enqueueing
        startPolling();
      } catch (error) {
        console.error("Error initializing suggestion generation:", error);
      }
    };

    initialize();

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (elapsedInterval) clearInterval(elapsedInterval);
    };
  }, [appId, router]);

  return <SuggestionsLoader pending={isPolling} elapsed={elapsed} />;
}
