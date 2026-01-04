import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "h-4 gap-1 border border-[#333] px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wider font-bold transition-all inline-flex items-center justify-center w-fit whitespace-nowrap shrink-0 overflow-hidden group/badge font-mono",
  {
    variants: {
      variant: {
        default: "bg-[#00ffcc] text-black hover:bg-[#fff]",
        secondary:
          "bg-[#333] text-white hover:bg-[#444]",
        destructive:
          "bg-[#ff0000] text-white hover:bg-[#cc0000]",
        outline:
          "border-[#00ffcc] text-[#00ffcc] bg-transparent hover:bg-[#00ffcc] hover:text-black",
        ghost:
          "hover:bg-[#111] text-[#888]",
        link: "text-[#00ffcc] underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ className, variant })),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
