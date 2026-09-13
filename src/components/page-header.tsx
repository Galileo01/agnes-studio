import { type LucideIcon } from "lucide-react";

export function PageHeader({ icon: Icon, eyebrow, title, description }: { icon: LucideIcon; eyebrow: string; title: string; description: string }) {
  return <header className="mb-7 flex items-start gap-3"><div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-black/[.07] bg-white text-neutral-700 dark:border-white/10 dark:bg-white/5 dark:text-neutral-200"><Icon className="size-[17px]" /></div><div><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">{eyebrow}</p><h1 className="text-2xl font-semibold tracking-[-.025em] sm:text-[28px]">{title}</h1><p className="mt-1.5 max-w-2xl text-sm leading-6 text-neutral-500">{description}</p></div></header>;
}
