import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function SuggestionsSkeleton({
  showNotice = false,
  count = 6,
}: {
  showNotice?: boolean;
  count?: number;
}) {
  return (
    <div className="flex flex-col gap-4">
      {showNotice && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertTitle className="text-sm font-semibold leading-tight">
            Finding similar games
          </AlertTitle>
          <AlertDescription className="leading-snug">
            We&apos;re analyzing this game to find recommendations. This can take
            up to 5 minutes. Check back soon.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="win95-card flex flex-col gap-2 p-3">
            <Skeleton className="w-full aspect-steam rounded-sm" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
