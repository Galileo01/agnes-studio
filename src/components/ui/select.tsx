import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export const Select = SelectPrimitive.Root;
export const SelectValue = SelectPrimitive.Value;
export function SelectTrigger({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  return <SelectPrimitive.Trigger className={cn("flex h-11 w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 dark:border-white/10 dark:bg-neutral-900", className)} {...props}>{children}<SelectPrimitive.Icon><ChevronDown className="size-4 opacity-50" /></SelectPrimitive.Icon></SelectPrimitive.Trigger>;
}
export function SelectContent({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return <SelectPrimitive.Portal><SelectPrimitive.Content position="popper" className={cn("z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-neutral-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-neutral-900", className)} {...props}><SelectPrimitive.Viewport>{children}</SelectPrimitive.Viewport></SelectPrimitive.Content></SelectPrimitive.Portal>;
}
export function SelectItem({ className, children, ...props }: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return <SelectPrimitive.Item className={cn("relative flex cursor-default select-none items-center rounded-lg py-2.5 pl-8 pr-3 text-sm outline-none data-[highlighted]:bg-violet-50 data-[highlighted]:text-violet-700 dark:data-[highlighted]:bg-violet-950", className)} {...props}><span className="absolute left-2"><SelectPrimitive.ItemIndicator><Check className="size-4" /></SelectPrimitive.ItemIndicator></span><SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText></SelectPrimitive.Item>;
}
