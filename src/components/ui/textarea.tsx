import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("flex min-h-28 w-full resize-none rounded-xl border border-neutral-200 bg-white p-4 text-sm leading-6 outline-none transition placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-100 dark:border-white/10 dark:bg-white/5 dark:focus:ring-white/10", className)} {...props} />
));
Textarea.displayName = "Textarea";
