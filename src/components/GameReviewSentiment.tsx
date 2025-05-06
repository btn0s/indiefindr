"use client";

import { useState, useEffect } from "react";
import { type RapidApiReview } from "@/lib/rapidapi/types";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils"; // For conditional classes

interface GameReviewSentimentProps {
  steamAppId: string | undefined | null;
}

interface Sentiment {
  label: string;
  className: string; // Tailwind class for color
}

// Function to calculate sentiment from reviews
const calculateSentiment = (reviews: RapidApiReview[]): Sentiment => {
  if (!reviews || reviews.length === 0) {
    return { label: "No Reviews", className: "bg-muted text-muted-foreground" };
  }

  let recommendedCount = 0;
  let notRecommendedCount = 0;

  reviews.forEach((review) => {
    if (review.title?.toLowerCase() === "recommended") {
      recommendedCount++;
    } else if (review.title?.toLowerCase() === "not recommended") {
      notRecommendedCount++;
    }
  });

  const totalRated = recommendedCount + notRecommendedCount;

  if (totalRated === 0) {
    // If reviews exist but none have a rating
    return { label: "Not Rated", className: "bg-muted text-muted-foreground" };
  }

  const positiveRatio = recommendedCount / totalRated;

  if (positiveRatio >= 0.95) {
    return {
      label: "Overwhelmingly Positive",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
  }
  if (positiveRatio >= 0.8) {
    return {
      label: "Very Positive",
      className:
        "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200",
    };
  }
  if (positiveRatio >= 0.7) {
    return {
      label: "Mostly Positive",
      className:
        "bg-lime-100 text-lime-700 dark:bg-lime-800 dark:text-lime-200",
    };
  }
  if (positiveRatio >= 0.4) {
    return {
      label: "Mixed",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200",
    };
  }
  if (positiveRatio >= 0.2) {
    return {
      label: "Mostly Negative",
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200",
    };
  }
  return {
    label: "Overwhelmingly Negative",
    className: "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200",
  };
};

export function GameReviewSentiment({ steamAppId }: GameReviewSentimentProps) {
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!steamAppId) {
      setLoading(false);
      setError(null);
      setSentiment(null);
      return;
    }

    const fetchAndCalculateSentiment = async () => {
      setLoading(true);
      setSentiment(null);
      setError(null);
      try {
        // Fetch more reviews to get a better sample size for sentiment
        const response = await fetch(
          `/api/game-reviews?appId=${steamAppId}&limit=30`
        );
        if (!response.ok) {
          let errorMsg = `API Error: ${response.status}`;
          try {
            const errData = await response.json();
            errorMsg = errData.error || errorMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg);
        }
        const data = await response.json();
        console.log("[GameReviewSentiment] Fetched data:", data);
        if (Array.isArray(data.reviews)) {
          const calculatedSentiment = calculateSentiment(data.reviews);
          console.log(
            "[GameReviewSentiment] Calculated sentiment:",
            calculatedSentiment
          );
          setSentiment(calculatedSentiment);
        } else {
          console.warn("API did not return an array of reviews", data);
          setError("Invalid data format");
          setSentiment(null);
        }
      } catch (err) {
        console.error("Failed to fetch/calculate sentiment:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load sentiment"
        );
        setSentiment(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAndCalculateSentiment();
  }, [steamAppId]);

  if (loading) {
    return null;
  }

  if (error) {
    console.warn(`GameReviewSentiment error for ${steamAppId}: ${error}`);
    console.log("[GameReviewSentiment] Returning null due to error.");
    return null;
  }

  if (
    !sentiment ||
    sentiment.label === "No Reviews" ||
    sentiment.label === "Not Rated"
  ) {
    console.log(
      "[GameReviewSentiment] Returning null due to no/invalid sentiment:",
      sentiment
    );
    return null;
  }

  return (
    <Badge
      className={cn("text-xs font-medium align-middle", sentiment.className)}
    >
      {sentiment.label}
    </Badge>
  );
}
