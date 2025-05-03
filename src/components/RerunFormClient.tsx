"use client";

import React, { useEffect, useRef, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// Import the action state type from the actions file
import type { RerunState } from "../app/finds/[slug]/actions";

// Type for the server action prop
type RerunAnalysisAction = (
  prevState: RerunState,
  formData: FormData
) => Promise<RerunState>;

// Props for the client component
interface RerunFormClientProps {
  findId: number;
  sourceTweetUrl: string | null;
  rerunAnalysisAction: RerunAnalysisAction;
}

// Submit button component
function RerunButton({ sourceTweetUrl }: { sourceTweetUrl: string | null }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) {
      toast.info("Rerunning analysis...", { duration: 15000 });
    }
  }, [pending]);

  return (
    <Button
      type="submit"
      disabled={pending || !sourceTweetUrl}
      variant="outline"
      aria-disabled={pending || !sourceTweetUrl}
    >
      {pending ? "Rerunning..." : "Rerun Analysis"}
    </Button>
  );
}

// The minimal client component for the form
export function RerunFormClient({
  findId,
  sourceTweetUrl,
  rerunAnalysisAction,
}: RerunFormClientProps) {
  const [state, formAction] = useActionState<RerunState, FormData>(
    rerunAnalysisAction,
    { message: null }
  );

  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    if (state?.message) {
      toast.error(`Rerun failed: ${state.message}`);
    }
  }, [state]);

  return (
    <form
      action={formAction}
      className="mb-4 flex justify-end items-center gap-2"
    >
      <input type="hidden" name="sourceTweetUrl" value={sourceTweetUrl ?? ""} />
      <input type="hidden" name="currentFindId" value={findId} />

      {/* Display Server Action Error Message */}
      {state?.message && (
        <p className="text-red-600 text-sm mr-auto">{state.message}</p>
      )}

      {/* Client-side check for missing URL before allowing submit */}
      {!sourceTweetUrl && (
        <p className="text-orange-600 text-sm mr-auto">
          Cannot rerun analysis: Source Tweet URL is missing.
        </p>
      )}

      <RerunButton sourceTweetUrl={sourceTweetUrl} />
    </form>
  );
}
