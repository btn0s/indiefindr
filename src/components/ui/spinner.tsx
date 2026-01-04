import { cn } from "@/lib/utils"

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div 
      role="status" 
      aria-label="Loading" 
      className={cn("font-mono text-xs animate-pulse text-[#00ffcc]", className)} 
      {...props}
    >
      [LOADING...]
    </div>
  )
}

export { Spinner }
