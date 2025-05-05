"use client";

import { useState, useEffect } from "react";
import { type RapidApiReview } from "@/lib/rapidapi/types";
import { Skeleton } from "./ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface GameReviewsDisplayProps {
  steamAppId: string | undefined | null;
}

export function GameReviewsDisplay({ steamAppId }: GameReviewsDisplayProps) {
  const [reviews, setReviews] = useState<RapidApiReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!steamAppId) {
      setLoading(false);
      setError("Missing Steam App ID");
      setReviews([]); // Ensure reviews are cleared
      return;
    }

    const fetchReviews = async () => {
      setLoading(true);
      setReviews([]);
      setError(null);
      try {
        const response = await fetch(`/api/game-reviews?appId=${steamAppId}`);
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
        // Ensure data.reviews is an array before setting
        if (Array.isArray(data.reviews)) {
          setReviews(data.reviews);
        } else {
          console.warn("API did not return an array of reviews", data);
          setReviews([]); // Set empty array if response format is wrong
          setError("Invalid data format received");
        }
      } catch (err) {
        console.error("Failed to fetch game reviews:", err);
        setError(err instanceof Error ? err.message : "Failed to load reviews");
        setReviews([]); // Ensure reviews are cleared on error
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [steamAppId]);

  if (!steamAppId) {
    // Don't render anything if no appId is provided (or handle differently if needed)
    return null;
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-32 bg-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full bg-muted" />
          <Skeleton className="h-4 w-4/5 bg-muted" />
          <Skeleton className="h-4 w-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">
            Error Loading Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (reviews.length === 0) {
    // Optionally render a message when no reviews are found
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No recent reviews found for this game.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reviews</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {reviews.map((review, index) => (
          <div key={index} className="border-b pb-3 last:border-b-0">
            {review.rating && (
              <Badge
                variant={
                  review.rating.toLowerCase() === "recommended"
                    ? "default"
                    : "destructive"
                }
                className="mb-1 text-xs"
              >
                {review.rating}
              </Badge>
            )}
            <p className="text-sm text-muted-foreground">
              {review.review_text || <i>No review text provided.</i>}
            </p>
            {/* Add author/date if available and desired */}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
