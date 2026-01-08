"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

function SkeletonCard() {
  return (
    <div>
      <div className="relative w-full mb-2 overflow-hidden rounded-md bg-muted aspect-steam animate-pulse" />
      <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-1" />
      <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SuggestionsLoader({ autoSubmit = false }: { autoSubmit?: boolean }) {
  const { pending } = useFormStatus();
  const formRef = useRef<HTMLFormElement | null>(null);
  const submitted = useRef(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (autoSubmit && !submitted.current && formRef.current) {
      submitted.current = true;
      formRef.current.requestSubmit();
    }
  }, [autoSubmit]);

  useEffect(() => {
    if (!pending) {
      setElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [pending]);

  return (
    <>
      <button
        ref={(el) => {
          formRef.current = el?.form ?? null;
        }}
        type="submit"
        disabled={pending}
        className={
          pending
            ? "sr-only"
            : "px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium disabled:opacity-50"
        }
      >
        {pending ? "Generating..." : "Generate Suggestions"}
      </button>
      {pending && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Finding similar games...</span>
            <span className="tabular-nums">{elapsed}s</span>
          </div>
          <SkeletonGrid />
        </div>
      )}
    </>
  );
}
