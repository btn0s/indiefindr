import { Progress } from "@ui-sdk/react/progress";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
export function Spinner({ className }: { className?: string }) {
  return <Progress value={null} aria-label="Loading" className={cn("inline-flex", className)}><Loader2Icon aria-hidden="true" className="size-4 animate-spin" /></Progress>;
}
