"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  getLibraryGameIds as getLibraryGameIdsAction,
  addToLibrary as addToLibraryAction,
  removeFromLibrary as removeFromLibraryAction,
} from "@/app/actions/library"; // Adjust path as necessary
import { createClient } from "@/utils/supabase/client"; // For client-side Supabase

interface LibraryContextValue {
  libraryGameIds: Set<number>;
  isLoading: boolean;
  addToLibrary: (gameId: number) => Promise<void>;
  removeFromLibrary: (gameId: number) => Promise<void>;
  isGameInLibrary: (gameId: number) => boolean;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(
  undefined
);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [libraryGameIds, setLibraryGameIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    const getUserAndFetchLibrary = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        setIsLoading(true);
        try {
          const result = await getLibraryGameIdsAction();
          if (result.success && result.data) {
            setLibraryGameIds(new Set(result.data));
          }
        } catch (error) {
          console.error("Failed to fetch library game IDs:", error);
        }
        setIsLoading(false);
      } else {
        setUserId(null);
        setLibraryGameIds(new Set()); // Clear library for logged-out user
        setIsLoading(false);
      }
    };

    getUserAndFetchLibrary();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN") {
          setUserId(session?.user?.id || null);
          getUserAndFetchLibrary(); // Refetch library on sign-in
        } else if (event === "SIGNED_OUT") {
          setUserId(null);
          setLibraryGameIds(new Set());
          setIsLoading(false);
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [supabase]);

  const addToLibrary = useCallback(
    async (gameId: number) => {
      if (!userId) return; // Or handle anonymous attempts
      const originalLibrary = new Set(libraryGameIds);
      setLibraryGameIds((prev) => new Set(prev).add(gameId));
      try {
        await addToLibraryAction(gameId);
        // Server action revalidation is removed for '/', so client state is source of truth
      } catch (error) {
        console.error("Failed to add to library:", error);
        setLibraryGameIds(originalLibrary); // Revert on error
        // Optionally, show a toast notification
      }
    },
    [userId, libraryGameIds]
  );

  const removeFromLibrary = useCallback(
    async (gameId: number) => {
      if (!userId) return;
      const originalLibrary = new Set(libraryGameIds);
      setLibraryGameIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(gameId);
        return newSet;
      });
      try {
        await removeFromLibraryAction(gameId);
      } catch (error) {
        console.error("Failed to remove from library:", error);
        setLibraryGameIds(originalLibrary); // Revert on error
        // Optionally, show a toast notification
      }
    },
    [userId, libraryGameIds]
  );

  const isGameInLibrary = useCallback(
    (gameId: number) => {
      return libraryGameIds.has(gameId);
    },
    [libraryGameIds]
  );

  return (
    <LibraryContext.Provider
      value={{
        libraryGameIds,
        isLoading,
        addToLibrary,
        removeFromLibrary,
        isGameInLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = (): LibraryContextValue => {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return context;
};
