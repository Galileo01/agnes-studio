import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getModel, getModels, type ModelKind, type PriceStatus } from "@/lib/models";
import { cn } from "@/lib/utils";

const labels: Record<PriceStatus, string> = { free: "免费", "limited-free": "限时免费", paid: "付费", unknown: "待确认" };
const styles: Record<PriceStatus, string> = { free: "border-[#b9e8cc] bg-[#eaf8ef] text-[#247548]", "limited-free": "border-amber-200 bg-amber-50 text-amber-700", paid: "border-neutral-200 bg-neutral-100 text-neutral-600", unknown: "border-neutral-200 bg-neutral-50 text-neutral-500" };

export function PriceBadge({ status, compact = false }: { status: PriceStatus; compact?: boolean }) { return <Badge className={cn(styles[status], compact && "px-2 py-0.5 text-[10px]")}>{labels[status]}</Badge>; }

export function ModelPicker({ kind, value, onChange, compact = false }: { kind: ModelKind; value: string; onChange: (value: string) => void; compact?: boolean }) {
  const model = getModel(value)!;
  return <div className={compact ? "flex items-center gap-2" : "space-y-3"}>
    {!compact && <div className="flex items-center justify-between"><label className="text-xs font-medium text-neutral-500">模型</label><a href={model.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-900 dark:hover:text-white">模型文档 <ExternalLink className="size-3" /></a></div>}
    <Select value={value} onValueChange={onChange}><SelectTrigger className={compact ? "h-8 w-auto min-w-[176px] rounded-full border-black/[.06] bg-white px-3 text-[13px] shadow-none dark:border-white/10 dark:bg-white/[.04]" : undefined}><SelectValue /></SelectTrigger><SelectContent>{getModels(kind).map((item) => <SelectItem key={item.id} value={item.id}>{item.name} · {labels[item.priceStatus]}</SelectItem>)}</SelectContent></Select>
    {compact ? null : <div className="rounded-xl bg-neutral-100/70 p-3.5 dark:bg-white/[.045]"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-medium">{model.name}</span><PriceBadge status={model.priceStatus} /></div><p className="mt-2 text-xs leading-5 text-neutral-500">{model.description}</p><div className="mt-2.5 flex flex-wrap gap-1.5">{model.tags.map((tag) => <Badge key={tag}>{tag}</Badge>)}</div><p className="mt-2.5 text-[10px] text-neutral-400">{model.priceNote} · 以账户账单为准</p></div>}
  </div>;
}
