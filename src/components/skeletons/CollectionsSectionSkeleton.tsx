import { Skeleton } from "@/components/ui/skeleton";

function CollectionRowSkeleton() {
  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="container mx-auto max-w-4xl w-full flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80 max-w-[70vw]" />
        </div>
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="container mx-auto max-w-4xl w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="w-full aspect-steam rounded-md" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CollectionsSectionSkeleton({ rows = 2 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-8 w-full">
      {Array.from({ length: rows }).map((_, i) => (
        <CollectionRowSkeleton key={i} />
      ))}
    </div>
  );
}

