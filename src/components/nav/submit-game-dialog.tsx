"use client";

import Link from "next/link";
import { Send, AlertCircle, CheckCircle2, Info } from "lucide-react";
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
import {
  submitGameAction,
  type SubmitGameState,
} from "@/app/(api)/actions/submit-game";
import { SubmitButton } from "@/components/submit-button";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { GameCard } from "@/components/game/game-card";
import { getGameUrl } from "@/utils/game-url";

export function SubmitGameDialog() {
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
      // toast.success(state.message || "Game added successfully!"); // Toast handled by renderDialogContent success view
      formRef.current?.reset();
    } else if (state.status === "exists") {
      toast.info(state.message);
    } else if (state.status === "error") {
      toast.error(state.message);
    }
  }, [state, isPending]);

  const handleOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Reset state when dialog closes
      setSubmissionResult(null);
      // Optionally, reset the action state if your library supports it,
      // or manage it such that it doesn't show old errors on reopen.
      // For now, just resetting the form and local submissionResult.
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
              "{game.title || "This game"}" has been added to IndieFindr.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto px-1 py-1 scrollbar-thin scrollbar-thumb-muted-foreground/50">
            <GameCard game={game} />
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
                        submissionResult.submittedGameData?.title || null
                      )}
                      className="underline ml-1 font-medium"
                    >
                      Check it out!
                    </Link>
                  )}
                </span>
              </p>
            )}
            {!submissionResult && ( // Show description only if no submission attempt has been made yet
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
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" aria-label="Submit Game">
          Submit Find
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {renderDialogContent()}
      </DialogContent>
    </Dialog>
  );
}
