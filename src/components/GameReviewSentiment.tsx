"use client";

import { type RapidApiReview } from "@/lib/rapidapi/types";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils"; // For conditional classes
// Skeleton is no longer needed if we pass data directly
// import { Skeleton } from "./ui/skeleton";

// Define the props to accept the reviews array
interface GameReviewSentimentProps {
  reviews: RapidApiReview[] | null | undefined;
}

interface Sentiment {
  label: string;
  className: string; // Tailwind class for color
}

// Function to calculate sentiment from reviews (remains the same)
const calculateSentiment = (
  reviews: RapidApiReview[] | null | undefined
): Sentiment => {
  if (!reviews || reviews.length === 0) {
    return { label: "No Reviews", className: "bg-muted text-muted-foreground" };
  }

  let recommendedCount = 0;
  let notRecommendedCount = 0;

  // Use title field for sentiment (adjust if API provides a different field)
  reviews.forEach((review) => {
    // Handle potential variations in casing and wording
    const titleLower = review.title?.trim().toLowerCase();
    if (titleLower === "recommended") {
      recommendedCount++;
    } else if (titleLower === "not recommended") {
      notRecommendedCount++;
    }
    // Add more robust checks if needed (e.g., check rating field)
  });

  const totalRated = recommendedCount + notRecommendedCount;

  if (totalRated === 0) {
    return { label: "Not Rated", className: "bg-muted text-muted-foreground" };
  }

  const positiveRatio = recommendedCount / totalRated;

  // Sentiment calculation logic (remains the same)
  if (positiveRatio >= 0.95) {
    return {
      label: "Overwhelmingly Positive",
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-300",
    };
  }
  if (positiveRatio >= 0.8) {
    return {
      label: "Very Positive",
      className:
        "bg-green-100 text-green-700 dark:bg-green-800 dark:text-green-200 border border-green-200",
    };
  }
  if (positiveRatio >= 0.7) {
    return {
      label: "Mostly Positive",
      className:
        "bg-lime-100 text-lime-700 dark:bg-lime-800 dark:text-lime-200 border border-lime-200",
    };
  }
  if (positiveRatio >= 0.4) {
    return {
      label: "Mixed",
      className:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-800 dark:text-yellow-200 border border-yellow-200",
    };
  }
  if (positiveRatio >= 0.2) {
    return {
      label: "Mostly Negative",
      className:
        "bg-orange-100 text-orange-700 dark:bg-orange-800 dark:text-orange-200 border border-orange-200",
    };
  }
  return {
    label: "Overwhelmingly Negative",
    className:
      "bg-red-100 text-red-700 dark:bg-red-800 dark:text-red-200 border border-red-200",
  };
};

// Updated component: Receives reviews via props, no internal fetching
export function GameReviewSentiment({ reviews }: GameReviewSentimentProps) {
  // Calculate sentiment directly from props
  const sentiment = calculateSentiment(reviews);

  // No loading or error state needed here as data comes from parent

  return (
    <Badge
      variant="secondary" // Base variant
      className={cn(
        "text-xs font-medium align-middle transition-colors duration-200 px-1.5 py-0.5",
        sentiment.className // Apply calculated sentiment class
      )}
    >
      {sentiment.label} {/* Display the calculated label */}
    </Badge>
  );
}
