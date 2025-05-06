"use client";

import React, { useState, useEffect, useRef, FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

// Import the report schema for type checking the response
import type { DetailedIndieGameReport } from "@/schema";
import { Recycle } from "lucide-react";

// Props for the client component
interface RerunFormClientProps {
  findId: number;
  sourceSteamUrl: string | null;
}

// Submit button component
function RerunButton({
  sourceSteamUrl,
  isSubmitting,
}: {
  sourceSteamUrl: string | null;
  isSubmitting: boolean;
}) {
  return (
    <Button
      type="submit"
      disabled={isSubmitting || !sourceSteamUrl}
      variant="secondary"
      aria-disabled={isSubmitting || !sourceSteamUrl}
      size="sm"
      className="text-xs"
    >
      <Recycle className="size-3" />
      {isSubmitting ? "Rerunning..." : "Rerun Analysis"}
    </Button>
  );
}

// The minimal client component for the form
export function RerunFormClient({
  findId,
  sourceSteamUrl,
}: RerunFormClientProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!sourceSteamUrl) {
      setError("Source Steam URL is missing.");
      toast.error("Cannot rerun analysis: Source Steam URL is missing.");
      return;
    }

    setIsSubmitting(true);
    toast.info("Rerunning analysis for Steam URL...", { duration: 15000 });

    try {
      const response = await fetch("/api/find", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ steam_link: sourceSteamUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMessage =
          result?.error || `HTTP error! Status: ${response.status}`;
        throw new Error(errorMessage);
      }

      const returnedFindId = result?.findId;

      if (!returnedFindId) {
        throw new Error("API did not return a Find ID after successful run.");
      }

      toast.success("Analysis rerun successful! Navigating...");
      router.push(`/finds/${returnedFindId}`);
    } catch (err: any) {
      const message = err.message || "An unexpected error occurred.";
      setError(message);
      toast.error(`Rerun failed: ${message}`);
      console.error("Rerun failed:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="text-red-600 text-sm mr-auto">{error}</p>}

      {!sourceSteamUrl && !error && (
        <p className="text-orange-600 text-sm mr-auto">
          Cannot rerun analysis: Source Steam URL is missing.
        </p>
      )}

      <RerunButton
        sourceSteamUrl={sourceSteamUrl}
        isSubmitting={isSubmitting}
      />
    </form>
  );
}
