import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertTitle } from "@/components/ui/alert";

export function SuggestionsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <Loader2 className="size-4 animate-spin" />
        <AlertTitle className="flex items-center gap-2">
          <span className="font-semibold">Finding similar games</span>{" "}
          <span className="font-normal! text-muted-foreground!">
            We&apos;re analyzing this game to find recommendations. This may
            take a minute.
          </span>
        </AlertTitle>
      </Alert>
      <div className="grid grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex flex-col">
            <Skeleton className="w-full aspect-video mb-2" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
