import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "bg-[#20201e] text-white shadow-sm hover:bg-black dark:bg-[#e8ff59] dark:text-black dark:hover:bg-[#dcf44e]",
      secondary: "bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:bg-white/10 dark:text-white",
      outline: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-white/10 dark:bg-white/5 dark:text-neutral-100",
      ghost: "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-white/10",
      danger: "bg-red-50 text-red-600 hover:bg-red-100",
    },
    size: { default: "h-10 px-4 py-2", sm: "h-8 rounded-lg px-3 text-xs", lg: "h-12 px-6 text-base", icon: "size-10 p-0" },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> { asChild?: boolean }
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = "Button";
