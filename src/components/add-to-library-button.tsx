"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { useLibrary } from "@/contexts/LibraryContext";
import { Bookmark, BookmarkCheck, XCircle } from "lucide-react";

interface AddToLibraryButtonProps {
  gameId: number;
  className?: string;
  variant?: "default" | "outline";
}

export function AddToLibraryButton({
  gameId,
  className = "",
  variant = "outline",
}: AddToLibraryButtonProps) {
  const { isGameInLibrary, addToLibrary, removeFromLibrary } = useLibrary();
  const [isHoveringRemove, setIsHoveringRemove] = useState(false);
  
  const isInLibrary = isGameInLibrary(gameId);

  const handleToggleLibrary = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      if (isInLibrary) {
        await removeFromLibrary(gameId);
      } else {
        await addToLibrary(gameId);
      }
    } catch (error) {
      console.error("Error toggling library status:", error);
    }
  };

  return (
    <Button
      variant={
        isInLibrary
          ? isHoveringRemove
            ? "destructive"
            : "secondary"
          : variant
      }
      className={`w-full flex items-center justify-center gap-1 ${className}`}
      onClick={handleToggleLibrary}
      title={isInLibrary ? "Remove from Library" : "Add to Library"}
      onMouseEnter={() => isInLibrary && setIsHoveringRemove(true)}
      onMouseLeave={() => setIsHoveringRemove(false)}
    >
      {isInLibrary ? (
        isHoveringRemove ? (
          <XCircle className="h-4 w-4 mr-1" />
        ) : (
          <BookmarkCheck className="h-4 w-4 mr-1" />
        )
      ) : (
        <Bookmark className="h-4 w-4 mr-1" />
      )}
      {isInLibrary ? (isHoveringRemove ? "Remove from Library" : "In Library") : "Add to Library"}
    </Button>
  );
}

