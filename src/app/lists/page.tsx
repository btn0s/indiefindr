"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Eye, EyeOff, ArrowLeft, List } from "lucide-react";
import { toast } from "sonner";
import type { Collection } from "@/lib/supabase/types";

type ListWithCount = Collection & { game_count: number };

export default function ListsPage() {
  const router = useRouter();
  const [lists, setLists] = useState<ListWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  const loadLists = async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    try {
      const { data: userLists, error } = await supabase
        .from("collections")
        .select("*")
        .eq("owner_id", user.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      const listsWithCounts = await Promise.all(
        (userLists || []).map(async (list) => {
          const { count } = await supabase
            .from("collection_games")
            .select("*", { count: "exact", head: true })
            .eq("collection_id", list.id);
          return { ...list, game_count: count || 0 };
        })
      );

      setLists(listsWithCounts);
    } catch (error) {
      toast.error("Failed to load lists");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLists();

    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        router.push("/login");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router]);

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      toast.error("Please enter a list name");
      return;
    }

    setIsCreating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error } = await supabase.from("collections").insert({
        owner_id: user.id,
        title: newListName.trim(),
        is_default: false,
        is_public: true,
        published: false,
        pinned_to_home: false,
        home_position: 0,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("List created!");
      setShowCreateDialog(false);
      setNewListName("");
      loadLists();
    } catch (error) {
      toast.error("Failed to create list");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteList = async (listId: string, isDefault: boolean) => {
    if (isDefault) {
      toast.error("Cannot delete your default saved list");
      return;
    }

    setDeletingListId(listId);
    try {
      const supabase = getSupabaseBrowserClient();

      const { error: gamesError } = await supabase
        .from("collection_games")
        .delete()
        .eq("collection_id", listId);

      if (gamesError) {
        toast.error(gamesError.message);
        return;
      }

      const { error: listError } = await supabase
        .from("collections")
        .delete()
        .eq("id", listId);

      if (listError) {
        toast.error(listError.message);
        return;
      }

      toast.success("List deleted");
      setLists(lists.filter((l) => l.id !== listId));
    } catch (error) {
      toast.error("Failed to delete list");
    } finally {
      setDeletingListId(null);
    }
  };

  const handleToggleVisibility = async (list: ListWithCount) => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("collections")
        .update({ is_public: !list.is_public })
        .eq("id", list.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      setLists(
        lists.map((l) =>
          l.id === list.id ? { ...l, is_public: !l.is_public } : l
        )
      );
      toast.success(list.is_public ? "List is now private" : "List is now public");
    } catch (error) {
      toast.error("Failed to update visibility");
    }
  };

  if (isLoading) {
    return (
      <main className="container mx-auto max-w-4xl py-6 sm:py-8">
        <div className="flex flex-col items-center justify-center gap-4 py-12">
          <Spinner className="h-8 w-8" />
          <p className="text-sm text-muted-foreground">Loading lists...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-4xl py-6 sm:py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/saved">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <List className="h-5 w-5" />
            <h1 className="text-2xl font-semibold">Your Lists</h1>
          </div>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          New List
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {lists.map((list) => (
          <div
            key={list.id}
            className="flex items-center justify-between p-4 border rounded-lg"
          >
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Link href={list.is_default ? "/saved" : `/lists/${list.id}`}>
                  <span className="font-medium hover:underline">{list.title}</span>
                </Link>
                {list.is_default && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded">Default</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {list.game_count} {list.game_count === 1 ? "game" : "games"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleToggleVisibility(list)}
              >
                {list.is_public ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
              {!list.is_default && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteList(list.id, list.is_default)}
                  disabled={deletingListId === list.id}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {lists.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <p className="text-muted-foreground">You don't have any lists yet.</p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4" />
              Create your first list
            </Button>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New List</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="List name"
              value={newListName}
              onChange={(e) => setNewListName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateList();
                }
              }}
              disabled={isCreating}
              maxLength={100}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setNewListName("");
              }}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateList} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
