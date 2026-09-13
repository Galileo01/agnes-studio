import { cn } from "@/lib/utils";
export function Badge({ className, ...props }: React.ComponentProps<"span">) { return <span className={cn("inline-flex items-center rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-300", className)} {...props} />; }
