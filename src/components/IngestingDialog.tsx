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
          <DialogTitle>Processing Data Request</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {gameImage && (
            <div className="relative w-32 h-16 border border-[#333]">
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
            <p className="text-lg font-bold uppercase tracking-wide text-center text-[#e0e0e0]">{gameTitle}</p>
          )}
          <div className="flex items-center gap-2 text-[#00ffcc]">
            <Spinner className="size-4" />
            <p className="text-sm font-mono uppercase">Initializing...</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
