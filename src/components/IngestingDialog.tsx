"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import Image from "next/image";

interface IngestingDialogProps {
  open: boolean;
  gameTitle?: string;
  gameImage?: string | null;
}

export function IngestingDialog({
  open,
  gameTitle,
  gameImage,
}: IngestingDialogProps) {
  return (
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adding to database</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {gameImage && (
            <div className="relative w-32 h-16 retro-frame">
              <Image
                src={gameImage}
                alt={gameTitle || "Game"}
                fill
                className="object-cover"
                sizes="128px"
              />
            </div>
          )}
          {gameTitle && (
            <p className="text-lg font-medium text-center">{gameTitle}</p>
          )}
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-4" />
            <p className="text-sm">Please wait...</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
