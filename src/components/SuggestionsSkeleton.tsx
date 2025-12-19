import { Skeleton } from "@/components/ui/skeleton";

export function SuggestionsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex flex-col">
          <Skeleton className="w-full aspect-video mb-2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full mt-2" />
        </div>
      ))}
    </div>
  );
}
