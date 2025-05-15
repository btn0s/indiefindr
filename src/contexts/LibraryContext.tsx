"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  addToLibrary as addToLibraryAction,
  removeFromLibrary as removeFromLibraryAction,
} from "@/app/(api)/actions/library"; // Adjust path as necessary
import { createClient } from "@/utils/supabase/client"; // For client-side Supabase
import { Game } from "@/lib/repositories/game-repository"; // Assuming Game type is needed
import { User } from "@supabase/supabase-js";

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

export const LibraryProvider: React.FC<{
  children: React.ReactNode;
  initialLibraryGameIds?: number[];
}> = ({
  children,
  initialLibraryGameIds = [], // Default to empty array if not provided
}) => {
  const [libraryGameIds, setLibraryGameIds] = useState<Set<number>>(
    new Set(initialLibraryGameIds)
  );
  const [isLoading, setIsLoading] = useState(true); // Default to true, set to false after initial check
  const [userId, setUserId] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    let isMounted = true; // To prevent state updates on unmounted component

    const initializeProviderState = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;

      if (user) {
        setUserId(user.id);
        // If initialLibraryGameIds are provided (from SSR) and the set is not empty,
        // we can assume they are fresh for the initial load.
        if (initialLibraryGameIds && initialLibraryGameIds.length > 0) {
          setLibraryGameIds(new Set(initialLibraryGameIds));
          setIsLoading(false);
        } else {
          // No initial IDs, or they were empty (e.g., new user, or SSR with no user)
          // Fetch from API
          setIsLoading(true);
          try {
            const response = await fetch("/api/me/library-ids");
            if (!isMounted) return;
            if (!response.ok) {
              throw new Error(
                `API request failed with status ${response.status}`
              );
            }
            const result = await response.json();
            if (result.gameIds) {
              setLibraryGameIds(new Set(result.gameIds));
            }
          } catch (error) {
            console.error("Failed to fetch library game IDs:", error);
            setLibraryGameIds(new Set()); // Clear on error
          }
          setIsLoading(false);
        }
      } else {
        // No user logged in
        setUserId(null);
        setLibraryGameIds(new Set());
        setIsLoading(false);
      }
    };

    initializeProviderState();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        setIsLoading(true); // Set loading true during auth changes
        if (event === "SIGNED_IN" && session?.user) {
          setUserId(session.user.id);
          // Fetch library for newly signed-in user
          try {
            const response = await fetch("/api/me/library-ids");
            if (!isMounted) return;
            if (!response.ok)
              throw new Error("Failed to fetch library on sign-in");
            const result = await response.json();
            if (result.gameIds) setLibraryGameIds(new Set(result.gameIds));
          } catch (error) {
            console.error(
              "Auth Listener: Failed to fetch library game IDs:",
              error
            );
            setLibraryGameIds(new Set());
          }
        } else if (event === "SIGNED_OUT") {
          setUserId(null);
          setLibraryGameIds(new Set());
        }
        setIsLoading(false);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription.unsubscribe();
    };
    // initialLibraryGameIds is included as a dependency. If it changes (e.g. different user from SSR),
    // this effect will re-run. Supabase client is stable.
  }, [supabase, initialLibraryGameIds]);

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
