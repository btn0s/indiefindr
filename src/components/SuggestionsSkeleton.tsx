import { Spinner } from "@/components/ui/spinner";
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
          <Spinner className="size-4 animate-spin text-[#00ffcc]" />
          <AlertTitle className="text-sm font-bold leading-tight text-[#00ffcc]">
            ANALYZING DATABASE
          </AlertTitle>
          <AlertDescription className="leading-snug">
            Processing game data to find optimal matches...
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {Array.from({ length: count }).map((_, index) => (
          <div key={index} className="flex flex-col p-1 bg-[#111] bevel-up">
            <Skeleton className="w-full aspect-steam mb-2 border border-[#333]" />
            <Skeleton className="h-4 w-3/4 mb-1" />
            <Skeleton className="h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
