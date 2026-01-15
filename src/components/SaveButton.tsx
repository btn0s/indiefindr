"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isGameSaved, toggleSaveGame } from "@/lib/actions/saved-lists";
import { toast } from "sonner";

interface SaveButtonProps {
  appid: number;
}

export function SaveButton({ appid }: SaveButtonProps) {
  const router = useRouter();
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuthAndSaved = async () => {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      setUserId(user.id);
      const saved = await isGameSaved(user.id, appid);
      setIsSaved(saved);
      setIsLoading(false);
    };

    checkAuthAndSaved();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        setUserId(session.user.id);
        isGameSaved(session.user.id, appid).then((saved) => {
          setIsSaved(saved);
          setIsLoading(false);
        });
      } else if (event === "SIGNED_OUT") {
        setUserId(null);
        setIsSaved(false);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [appid]);

  const handleClick = async () => {
    if (!userId) {
      router.push("/login");
      return;
    }

    setIsToggling(true);
    try {
      const result = await toggleSaveGame(userId, appid);
      if (result.error) {
        toast.error(result.error);
      } else {
        setIsSaved(result.saved ?? false);
        toast.success(result.saved ? "Game saved!" : "Game removed from saved");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save game");
    } finally {
      setIsToggling(false);
    }
  };

  if (isLoading) {
    return (
      <Button variant="outline" disabled>
        <Bookmark className="h-4 w-4" />
        Save
      </Button>
    );
  }

  return (
    <Button
      variant={isSaved ? "default" : "outline"}
      onClick={handleClick}
      disabled={isToggling}
    >
      {isSaved ? (
        <>
          <BookmarkCheck className="h-4 w-4" />
          Saved
        </>
      ) : (
        <>
          <Bookmark className="h-4 w-4" />
          Save
        </>
      )}
    </Button>
  );
}
