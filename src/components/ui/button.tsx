import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 active:translate-y-[1px] font-sans",
  {
    variants: {
      variant: {
        default: "bevel-up bg-[#222] text-[#00ffcc] hover:bg-[#333] hover:text-[#00ffcc] border border-[#444]",
        destructive: "bevel-up bg-[#300] text-[#ff0000] hover:bg-[#400] border border-[#600]",
        outline: "border border-[#333] bg-transparent hover:bg-[#111] text-[#e0e0e0]",
        secondary: "bevel-up bg-[#e0e0e0] text-black hover:bg-[#ccc]",
        ghost: "hover:bg-[#111] hover:text-[#00ffcc]",
        link: "text-[#00ffcc] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 px-3 py-1",
        sm: "h-7 px-2",
        lg: "h-10 px-6",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
