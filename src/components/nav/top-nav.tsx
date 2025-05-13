"use client";

import Link from "next/link";
import { Send, SearchIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AuthButton from "@/components/header-auth";
import {
  submitGameAction,
  type SubmitGameState,
} from "@/app/actions/submit-game";
import { SubmitButton } from "@/components/submit-button";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GameCard } from "@/components/game-card";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { getGameUrl } from "@/utils/game-url";

export function TopNav() {
  const initialState: SubmitGameState = { status: "idle", message: "" };
  const [state, formAction, isPending] = useActionState(
    submitGameAction,
    initialState
  );
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [submissionResult, setSubmissionResult] =
    useState<SubmitGameState | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!isPending && state.status !== "idle") {
      setSubmissionResult(state);
    }

    if (state.status === "success" && state.submittedGameData) {
      formRef.current?.reset();
    } else if (state.status === "exists") {
      toast.info(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state]);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      setSubmissionResult(null);
      formRef.current?.reset();
    }
  };

  const renderDialogContent = () => {
    if (
      submissionResult?.status === "success" &&
      submissionResult.submittedGameData
    ) {
      const game = submissionResult.submittedGameData;
      const detailsHref = getGameUrl(game.id, game.title);
      return (
        <>
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Game Added Successfully!
            </DialogTitle>
            <DialogDescription>
              " {game.title || "This game"} " has been added to IndieFindr.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1 py-1 scrollbar-thin scrollbar-thumb-muted-foreground/50">
            <GameCard game={game} detailsLinkHref={detailsHref} />
          </div>
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
            <Button asChild>
              <Link href={detailsHref}>View Details</Link>
            </Button>
          </DialogFooter>
        </>
      );
    } else {
      return (
        <>
          <DialogHeader>
            <DialogTitle>Submit a New Game</DialogTitle>
            {submissionResult?.status === "error" && (
              <p className="text-sm text-destructive pt-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />{" "}
                {submissionResult.message}
              </p>
            )}
            {submissionResult?.status === "exists" && (
              <p className="text-sm text-blue-600 pt-2 flex items-center gap-1.5">
                <Info className="h-4 w-4 flex-shrink-0" />
                <span>
                  {submissionResult.message}
                  {submissionResult.gameId && (
                    <Link
                      href={getGameUrl(
                        parseInt(submissionResult.gameId, 10),
                        submissionResult.existingGameTitle || null
                      )}
                      className="underline ml-1 font-medium"
                    >
                      Check it out!
                    </Link>
                  )}
                </span>
              </p>
            )}
            {!submissionResult && (
              <DialogDescription>
                Paste a Steam store page URL to add a game to IndieFindr.
              </DialogDescription>
            )}
          </DialogHeader>
          <form action={formAction} ref={formRef} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="steamUrl">Steam URL</Label>
              <Input
                id="steamUrl"
                name="steamUrl"
                placeholder="https://store.steampowered.com/app/..."
                required
                disabled={isPending}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <SubmitButton pendingText="Submitting..." disabled={isPending}>
                Submit Game
              </SubmitButton>
            </DialogFooter>
          </form>
        </>
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container max-w-5xl mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2 w-1/4">
          <Link href="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">IndieFindr</span>
          </Link>
        </div>

        <form
          action="/search"
          method="GET"
          className="hidden sm:flex flex-grow max-w-sm gap-2 mx-4"
        >
          <Input
            type="search"
            name="q"
            placeholder="Search games by title..."
            className="flex-grow"
            aria-label="Search games by title"
          />
        </form>

        <div className="flex items-center gap-2 w-1/4 justify-end">
          <AuthButton />
          <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Submit Game">
                <Send className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              {renderDialogContent()}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
