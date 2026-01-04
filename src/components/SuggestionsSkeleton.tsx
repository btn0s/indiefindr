import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" />
            <AlertTitle className="text-xs font-bold leading-tight m-0">
              Finding similar games
            </AlertTitle>
          </div>
          <AlertDescription className="text-xs mt-1">
            We&apos;re analyzing this game to find recommendations. This may
            take a minute.
          </AlertDescription>
        </Alert>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, index) => (
          <Card key={index} className="h-full opacity-60">
            <CardHeader>
              <CardTitle className="h-3 w-24 bg-black/5 animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="w-full aspect-steam win95-inset bg-black/5 animate-pulse" />
              <div className="flex flex-col gap-1">
                <div className="h-3 w-3/4 bg-black/10 animate-pulse" />
                <div className="h-3 w-full bg-black/10 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
