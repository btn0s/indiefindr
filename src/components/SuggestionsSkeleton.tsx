import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SuggestionsSkeleton({ showNotice = false }: { showNotice?: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      {showNotice && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertTitle className="text-sm font-semibold leading-tight">
            Finding similar games
          </AlertTitle>
          <AlertDescription className="leading-snug">
            We&apos;re analyzing this game to find recommendations. This may
            take a minute.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col">
            <Skeleton className="w-full aspect-steam mb-2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
