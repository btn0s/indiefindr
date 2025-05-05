"use client";

import { useState, useEffect } from "react";
import { type RapidApiPricing } from "@/lib/rapidapi/types";
import { Skeleton } from "./ui/skeleton";

interface GamePriceDisplayProps {
  // initialPricing is no longer used to determine display, but keep for potential future use?
  // Or remove if definitely not needed elsewhere.
  initialPricing: RapidApiPricing[] | undefined | null;
  gameName: string | undefined | null;
  steamAppId: string | undefined | null; // Steam App ID might correspond to RapidAPI ID
}

// Helper to get initial price, preferring "Play"/"Free" options
// This helper is no longer used for the primary logic, keep or remove?
// Let's keep it commented out for now in case it's useful later.
/*
const getInitialPrice = (
  pricing: RapidApiPricing[] | undefined | null
): string | null => {
  if (!pricing || pricing.length === 0) {
    return null;
  }
  // Prefer entries indicating free play
  const freePrice = pricing.find(
    (p) =>
      p.name?.toLowerCase().includes("play") ||
      p.price?.toLowerCase().includes("free")
  );
  if (freePrice && freePrice.price) {
    return freePrice.price;
  }
  // Otherwise, return the first available price
  return pricing[0]?.price || null;
};
*/

export function GamePriceDisplay({
  initialPricing, // Keep prop for now, but don't use for initial display
  gameName,
  steamAppId,
}: GamePriceDisplayProps) {
  // Remove initialPrice calculation
  // const initialPrice = getInitialPrice(initialPricing);

  // Always fetch, so start with null price and loading true
  const [price, setPrice] = useState<string | null>(null);
  // const [loading, setLoading] = useState<boolean>(!initialPrice); // Always start loading
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we don't have an initial price and have a gameName
    // if (initialPrice || !gameName) { // Update condition - always fetch if gameName exists
    if (!gameName) {
      // Only block fetch if gameName is missing
      setLoading(false);
      setError("Missing game name"); // Set error if no name
      return;
    }

    const fetchPrice = async () => {
      // Reset state for refetch if gameName changes
      setLoading(true);
      setPrice(null);
      setError(null);
      try {
        // Construct query params: only use gameName
        const queryParams = new URLSearchParams();
        if (gameName) {
          queryParams.set("gameName", gameName);
        } else {
          // This path should theoretically not be reached due to the check above
          throw new Error("Cannot fetch price without game name.");
        }

        const response = await fetch(
          `/api/game-price?${queryParams.toString()}`
        );
        if (!response.ok) {
          let errorMsg = `Error: ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        if (data.price && typeof data.price === "string") {
          setPrice(data.price);
        } else {
          setPrice(null); // Set to null if fetch yields no valid price
        }
      } catch (err) {
        console.error("Failed to fetch fallback price:", err);
        setError(err instanceof Error ? err.message : "Failed to load");
        setPrice(null); // Ensure price is null on error
      } finally {
        setLoading(false);
      }
    };

    fetchPrice();
    // Dependencies: Fetch only if gameName changes
    // }, [initialPrice, gameName]); // Update dependencies
  }, [gameName]);

  if (loading) {
    // Always show skeleton initially
    return <Skeleton className="h-4 w-16 bg-muted-foreground" />;
  }

  if (error) {
    // Optionally show an error indicator, or just default to N/A
    console.warn(`Price loading error: ${error}`);
    return <>N/A</>; // Fallback display on error
  }

  // Display fetched price or initial price, defaulting to N/A
  return <>{price || "N/A"}</>;
}
