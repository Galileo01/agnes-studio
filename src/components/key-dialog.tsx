import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { CheckCircle2, ExternalLink, Eye, EyeOff, KeyRound, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { clearApiKey, getApiKey, remembersApiKey, setApiKey } from "@/lib/storage";
import { PLATFORM_URL } from "@/lib/models";

export function KeyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [value, setValue] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (open) { setValue(getApiKey()); setRemember(remembersApiKey()); }
  }, [open]);

  const save = () => {
    if (!value.trim()) return;
    setApiKey(value, remember);
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-neutral-950/35 backdrop-blur-sm data-[state=open]:animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-white/50 bg-white p-6 shadow-2xl outline-none dark:border-white/10 dark:bg-neutral-900">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><KeyRound className="size-5" /></div>
              <div><Dialog.Title className="text-lg font-semibold">连接 AgnesAI</Dialog.Title><Dialog.Description className="mt-1 text-sm leading-6 text-neutral-500">使用你自己的 API Key。它只会随生成请求发送给同源 Worker。</Dialog.Description></div>
            </div>
            <Dialog.Close asChild><Button variant="ghost" size="icon" aria-label="关闭"><X className="size-4" /></Button></Dialog.Close>
          </div>

          <label className="mb-2 block text-sm font-medium">API Key</label>
          <div className="relative">
            <Input type={show ? "text" : "password"} value={value} onChange={(event) => setValue(event.target.value)} placeholder="粘贴 AgnesAI API Key" className="pr-11" autoComplete="off" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700" aria-label={show ? "隐藏 Key" : "显示 Key"}>{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
          </div>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-neutral-50 p-4 dark:bg-white/5">
            <input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="mt-1 size-4 accent-violet-600" />
            <span><span className="block text-sm font-medium">在此设备记住 Key</span><span className="mt-1 block text-xs leading-5 text-neutral-500">将明文保存在当前站点的浏览器存储中。同一浏览器里的脚本可能读取，请勿在公共设备启用。</span></span>
          </label>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <a href={PLATFORM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-700 hover:underline dark:text-violet-300">前往 AgnesAI 获取 Key <ExternalLink className="size-3.5" /></a>
            <div className="flex gap-2">
              {getApiKey() && <Button variant="danger" onClick={() => { clearApiKey(); setValue(""); }}><Trash2 className="size-4" />清除</Button>}
              <Button onClick={save} disabled={!value.trim()}><CheckCircle2 className="size-4" />保存连接</Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
