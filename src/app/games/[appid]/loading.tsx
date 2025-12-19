import { Navbar } from "@/components/Navbar";
import { Skeleton } from "@/components/ui/skeleton";
import { SuggestionsSkeleton } from "@/components/SuggestionsSkeleton";

export default function GamePageLoading() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 flex flex-col gap-3 sm:gap-4">
        {/* Title skeleton */}
        <Skeleton className="h-8 w-64" />

        {/* Video skeleton */}
        <Skeleton className="w-full aspect-video" />

        {/* Game header skeleton */}
        <div className="flex gap-3 sm:gap-4 items-center mb-4">
          <div className="flex-1 flex flex-col min-w-0 gap-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-8 w-32 mt-2" />
          </div>
        </div>

        {/* Suggestions section skeleton */}
        <div className="flex flex-col gap-2">
          <div className="flex sm:items-center justify-between gap-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-9 w-32" />
          </div>
          <SuggestionsSkeleton />
        </div>
      </main>
    </div>
  );
}
