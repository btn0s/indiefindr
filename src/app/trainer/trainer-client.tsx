"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Check, X } from "lucide-react";
import { submitJudgment } from "./actions";
import type { TrainerScreen } from "@/lib/trainer/types";

type Mark = "none" | "similar" | "not";

function questionFor(screen: TrainerScreen): string {
  if (screen.facet === "vibe") {
    return `Which of these FEEL like ${screen.seed.title}?`;
  }
  if (screen.facet === "mechanics") {
    return `Which of these PLAY like ${screen.seed.title}?`;
  }
  return `Which of these are similar to ${screen.seed.title}?`;
}

export function TrainerClient({ screen }: { screen: TrainerScreen }) {
  const router = useRouter();
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const startedAt = useRef(0);

  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  const counts = useMemo(() => {
    const values = Object.values(marks);
    return {
      similar: values.filter((m) => m === "similar").length,
      not: values.filter((m) => m === "not").length,
    };
  }, [marks]);

  function cycleMark(appid: number) {
    setMarks((prev) => {
      const current = prev[appid] ?? "none";
      const next: Mark =
        current === "none" ? "similar" : current === "similar" ? "not" : "none";
      return { ...prev, [appid]: next };
    });
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitJudgment({
        seedAppid: screen.seed.appid,
        shownAppids: screen.candidates.map((c) => c.appid),
        pickedAppids: screen.candidates
          .filter((c) => marks[c.appid] === "similar")
          .map((c) => c.appid),
        rejectedAppids: screen.candidates
          .filter((c) => marks[c.appid] === "not")
          .map((c) => c.appid),
        bestAppid: null,
        facet: screen.facet,
        samplerVersion: screen.samplerVersion,
        latencyMs: startedAt.current ? Date.now() - startedAt.current : 0,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to save");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex gap-4 items-start">
        <div className="relative w-48 shrink-0 overflow-hidden rounded-md bg-muted aspect-steam">
          {screen.seed.header_image && (
            <Image
              src={screen.seed.header_image}
              alt={screen.seed.title}
              fill
              sizes="192px"
              className="object-cover"
              priority
            />
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-lg font-semibold">{questionFor(screen)}</h1>
          {screen.seed.short_description && (
            <p className="text-sm text-muted-foreground line-clamp-3">
              {screen.seed.short_description}
            </p>
          )}
          {screen.seed.topTags.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {screen.seed.topTags.join(" · ")}
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-1">
            Tap once = similar, twice = definitely not, three times = clear.
            Skip anything you don&apos;t know.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {screen.candidates.map((candidate) => {
          const mark = marks[candidate.appid] ?? "none";
          return (
            <button
              key={candidate.appid}
              type="button"
              onClick={() => cycleMark(candidate.appid)}
              className="text-left group"
            >
              <div
                className={`relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam ring-2 transition-colors ${
                  mark === "similar"
                    ? "ring-green-500"
                    : mark === "not"
                      ? "ring-red-500"
                      : "ring-transparent group-hover:ring-border"
                }`}
              >
                {candidate.header_image && (
                  <Image
                    src={candidate.header_image}
                    alt={candidate.title}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover"
                  />
                )}
                {mark === "similar" && (
                  <span className="absolute top-1 right-1 rounded-full bg-green-500 text-white p-1">
                    <Check className="size-3" />
                  </span>
                )}
                {mark === "not" && (
                  <span className="absolute top-1 right-1 rounded-full bg-red-500 text-white p-1">
                    <X className="size-3" />
                  </span>
                )}
              </div>
              <div className="font-medium text-sm line-clamp-1">
                {candidate.title}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-1">
                {candidate.topTags.slice(0, 3).join(" · ")}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={submit}
          disabled={isPending}
          className="rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {isPending
            ? "Saving…"
            : counts.similar === 0 && counts.not === 0
              ? "None of these — next"
              : "Submit & next"}
        </button>
        <span className="text-xs text-muted-foreground">
          {counts.similar} similar · {counts.not} not
        </span>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </div>
  );
}
