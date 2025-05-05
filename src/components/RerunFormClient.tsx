"use client";

import React, { useEffect, useRef, useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation"; // Import useRouter

// Import the action state type from the actions file
import type { RerunState } from "../app/finds/[slug]/actions";

// Type for the server action prop (now specific to simple rerun)
type RerunSimpleAction = (
  prevState: RerunState,
  formData: FormData
) => Promise<RerunState>;

// Props for the client component
interface RerunFormClientProps {
  findId: number;
  sourceSteamUrl: string | null; // Specific prop name
  rerunSimpleAction: RerunSimpleAction; // Specific action prop name
}

// Submit button component
function RerunButton({ sourceSteamUrl }: { sourceSteamUrl: string | null }) {
  const { pending } = useFormStatus();

  useEffect(() => {
    if (pending) {
      toast.info("Rerunning analysis for Steam URL...", { duration: 15000 });
    }
  }, [pending]);

  return (
    <Button
      type="submit"
      disabled={pending || !sourceSteamUrl} // Disable if no URL or pending
      variant="outline"
      aria-disabled={pending || !sourceSteamUrl}
    >
      {pending ? "Rerunning..." : "Rerun Analysis"}
    </Button>
  );
}

// The minimal client component for the form
export function RerunFormClient({
  findId,
  sourceSteamUrl,
  rerunSimpleAction, // Use specific prop
}: RerunFormClientProps) {
  const [state, formAction] = useActionState<RerunState, FormData>(
    rerunSimpleAction, // Use the passed simple action
    { message: null }
  );

  const initialRender = useRef(true);
  const router = useRouter(); // Get router instance

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    // Handle state updates from the action
    if (state?.success && state.newSlug) {
      // On success, navigate to the new slug
      toast.success("Analysis rerun successful! Navigating...");
      router.push(`/finds/${state.newSlug}`);
    } else if (state?.message) {
      // On error, show toast
      toast.error(`Rerun failed: ${state.message}`);
    }
  }, [state, router]); // Add router to dependency array

  return (
    <form
      action={formAction}
      className="mb-4 flex justify-end items-center gap-2"
    >
      {/* Always use sourceSteamUrl as input name */}
      <input type="hidden" name="sourceSteamUrl" value={sourceSteamUrl ?? ""} />
      <input type="hidden" name="currentFindId" value={findId} />

      {/* Display Server Action Error Message */}
      {state?.message && (
        <p className="text-red-600 text-sm mr-auto">{state.message}</p>
      )}

      {/* Client-side check for missing URL before allowing submit */}
      {!sourceSteamUrl && (
        <p className="text-orange-600 text-sm mr-auto">
          Cannot rerun analysis: Source Steam URL is missing.
        </p>
      )}

      <RerunButton sourceSteamUrl={sourceSteamUrl} />
    </form>
  );
}
