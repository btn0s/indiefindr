import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-[#222] animate-pulse border border-[#333]", className)}
      {...props}
    />
  )
}

export { Skeleton }
