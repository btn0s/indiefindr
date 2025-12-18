"use client";

import { useState, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IS_DEV } from "@/lib/utils/dev";

interface RerunAllContextType {
  rerunning: boolean;
  rerunError: string | null;
  result: { successCount: number; failureCount: number } | null;
  handleRerunAll: () => Promise<void>;
}

const RerunAllContext = createContext<RerunAllContextType | null>(null);

export function RerunAllProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [rerunning, setRerunning] = useState(false);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    successCount: number;
    failureCount: number;
  } | null>(null);

  const handleRerunAll = async () => {
    if (
      !confirm(
        "This will re-ingest all games. This may take a while. Continue?"
      )
    ) {
      return;
    }

    setRerunning(true);
    setRerunError(null);
    setResult(null);

    try {
      const response = await fetch("/api/games/rerun-all", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to rerun all games");
      }

      setResult({
        successCount: data.successCount,
        failureCount: data.failureCount,
      });

      // Refresh the page to show updated data
      router.refresh();
    } catch (err) {
      setRerunError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRerunning(false);
    }
  };

  if (!IS_DEV) {
    return <>{children}</>;
  }

  return (
    <RerunAllContext.Provider
      value={{ rerunning, rerunError, result, handleRerunAll }}
    >
      {children}
    </RerunAllContext.Provider>
  );
}

export function RerunAllButton() {
  const context = useContext(RerunAllContext);

  if (!IS_DEV || !context) {
    return null;
  }

  const { rerunning, handleRerunAll } = context;

  return (
    <Button
      onClick={handleRerunAll}
      disabled={rerunning}
      variant="outline"
      size="sm"
    >
      {rerunning ? "Rerunning All..." : "Rerun All"}
    </Button>
  );
}

export function RerunAllMessages() {
  const context = useContext(RerunAllContext);
  if (!context) {
    return null;
  }

  const { rerunError, result } = context;

  if (!rerunError && !result) {
    return null;
  }

  return (
    <>
      {rerunError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
          <p className="text-destructive text-sm">{rerunError}</p>
        </div>
      )}
      {result && (
        <div className="p-3 bg-muted border rounded-md">
          <p className="text-sm">
            Completed: {result.successCount} succeeded, {result.failureCount}{" "}
            failed
          </p>
        </div>
      )}
    </>
  );
}
