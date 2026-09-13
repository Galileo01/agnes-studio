import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("flex h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-white/10", className)} {...props} />
));
Input.displayName = "Input";
