import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("rounded-2xl border border-black/[.075] bg-white shadow-[0_1px_2px_rgba(0,0,0,.025)] dark:border-white/10 dark:bg-white/[.04]", className)} {...props} />; }
export function CardHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("p-5 pb-3", className)} {...props} />; }
export function CardContent({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("p-5 pt-2", className)} {...props} />; }
