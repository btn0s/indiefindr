"use client";

import React from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

interface GameCardProps {
  game: {
    id: number; // Assuming external_source.id is a number
    title: string | null;
    shortDescription: string | null; // Placeholder, adjust based on actual data
    // Add other relevant game properties here, e.g., imageUrl, genres, etc.
  };
  isInLibrary: boolean; // To determine which button to show
  onAddToLibrary: (gameId: number) => Promise<any>; // Accept Promise<any> for Server Actions
  onRemoveFromLibrary: (gameId: number) => Promise<any>; // Accept Promise<any> for Server Actions
}

export function GameCard({
  game,
  isInLibrary,
  onAddToLibrary,
  onRemoveFromLibrary,
}: GameCardProps) {
  const handleAdd = async () => {
    // TODO: Add loading state/feedback
    try {
      await onAddToLibrary(game.id);
      // TODO: Add success feedback (e.g., toast)
    } catch (error) {
      console.error("Error adding to library:", error);
      // TODO: Add error feedback
    }
  };

  const handleRemove = async () => {
    // TODO: Add loading state/feedback
    try {
      await onRemoveFromLibrary(game.id);
      // TODO: Add success feedback
    } catch (error) {
      console.error("Error removing from library:", error);
      // TODO: Add error feedback
    }
  };

  return (
    <Card className="w-full">
      {" "}
      {/* Adjust width as needed */}
      <CardHeader>
        <CardTitle>{game.title || "Untitled Game"}</CardTitle>
        {/* Optional: Add image or other header content here */}
      </CardHeader>
      <CardContent>
        <CardDescription>
          {game.shortDescription || "No description available."}
        </CardDescription>
        {/* TODO: Add Genres/Tags if available */}
      </CardContent>
      <CardFooter className="flex justify-between">
        {/* Link to game detail page, styled as a button */}
        <Link
          href={`/game/${game.id}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Details
        </Link>
        {isInLibrary ? (
          <Button variant="secondary" size="sm" onClick={handleRemove}>
            Remove
          </Button>
        ) : (
          <Button variant="default" size="sm" onClick={handleAdd}>
            Add to Library
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
