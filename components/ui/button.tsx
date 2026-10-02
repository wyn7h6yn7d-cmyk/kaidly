import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Minimum heights: default 44 px and lg 48 px meet the touch-target rule in docs/DESIGN.md §6.
// Labels may wrap (long or translated text on narrow screens) instead of overflowing.
const buttonVariants = cva(
  "inline-flex max-w-full items-center justify-center gap-2 rounded-md text-center text-[15px] font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Volt fill with ink text (8.8:1), as on the brand board.
        default: "bg-k-volt text-k-ink hover:bg-k-volt-hover",
        // Deep green, for primary actions on paper where volt would be too loud.
        dark: "bg-k-green text-white hover:bg-k-green-hover",
        outline: "border border-k-ink/80 bg-transparent text-k-ink hover:bg-k-ink/5",
        ghost: "text-k-ink hover:bg-k-ink/5",
        destructive: "bg-k-danger text-white hover:bg-k-danger/90",
        link: "h-auto px-0 text-k-green underline underline-offset-4 hover:text-k-green-hover",
      },
      size: {
        default: "min-h-11 px-5 py-2",
        sm: "min-h-11 px-3 py-1.5 text-sm sm:min-h-9",
        lg: "min-h-12 px-6 py-2.5 text-base",
        // Marketing calls to action next to display-size headings.
        xl: "min-h-14 px-7 py-3 text-[17px] [&_svg]:size-5",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
