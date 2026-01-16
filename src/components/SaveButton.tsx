"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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
        const { data: list } = await supabase
          .from("collections")
          .select("id")
          .eq("owner_id", user.id)
          .eq("is_default", true)
          .maybeSingle();

        if (!list) {
          setIsSaved(false);
          return;
        }

        const { data: existing } = await supabase
          .from("collection_games")
          .select("appid")
          .eq("collection_id", list.id)
          .eq("appid", appid)
          .maybeSingle();

        setIsSaved(!!existing);
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
        // Re-check saved status
        (async () => {
          try {
            const { data: list } = await supabase
              .from("collections")
              .select("id")
              .eq("owner_id", session.user.id)
              .eq("is_default", true)
              .maybeSingle();

            if (!list) {
              setIsSaved(false);
              return;
            }

            const { data: existing } = await supabase
              .from("collection_games")
              .select("appid")
              .eq("collection_id", list.id)
              .eq("appid", appid)
              .maybeSingle();

            setIsSaved(!!existing);
          } finally {
            setIsLoading(false);
          }
        })();
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
      // Get or create default collection
      let { data: list } = await supabase
        .from("collections")
        .select("id")
        .eq("owner_id", uid)
        .eq("is_default", true)
        .maybeSingle();

      if (!list) {
        const { data: created, error: createError } = await supabase
          .from("collections")
          .insert({
            owner_id: uid,
            title: "Saved",
            is_default: true,
            is_public: true,
            published: false,
            pinned_to_home: false,
            home_position: 0,
          })
          .select("id")
          .single();

        if (createError) {
          toast.error(createError.message);
          return;
        }

        if (!created) {
          toast.error("Failed to create saved collection");
          return;
        }

        list = created;
      }

      const { data: existing } = await supabase
        .from("collection_games")
        .select("appid")
        .eq("collection_id", list.id)
        .eq("appid", appid)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("collection_games")
          .delete()
          .eq("collection_id", list.id)
          .eq("appid", appid);

        if (error) {
          toast.error(error.message);
          return;
        }

        setIsSaved(false);
        toast.success("Game removed from saved");
      } else {
        const { error } = await supabase.from("collection_games").insert({
          collection_id: list.id,
          appid,
          position: 0,
        });

        if (error) {
          toast.error(error.message);
          return;
        }

        setIsSaved(true);
        toast.success("Game saved!");
      }

      router.refresh();
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
