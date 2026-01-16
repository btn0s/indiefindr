"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isGameSaved } from "@/lib/actions/saved-lists";
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
      try {
        const saved = await isGameSaved(user.id, appid);
        setIsSaved(saved);
      } catch {
        // If saved-status lookup fails, still allow toggling.
      } finally {
        setIsLoading(false);
      }
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
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      router.push("/login");
      return;
    }

    const uid = session.user.id;
    if (!userId) {
      setUserId(uid);
    }

    setIsToggling(true);
    try {
      const response = await fetch("/api/saved", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          appid,
          accessToken: session.access_token,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.error || "Failed to save game");
        return;
      }

      const result = await response.json();
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
      <Button variant="outline" onClick={handleClick} disabled={isToggling}>
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
