import { Skeleton } from "@/components/ui/skeleton";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";

export function GameDetailSkeleton() {
  return (
    <>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="w-full aspect-video" />

      <div className="flex gap-3 sm:gap-4 items-center mb-4">
        <div className="flex-1 flex flex-col min-w-0 gap-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-8 w-32 mt-2" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <Skeleton className="h-6 w-64 max-w-full" />
        </div>
        <SuggestionsSkeleton showNotice={false} />
      </div>
    </>
  );
}

