import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  FileImage,
  Film,
  KeyRound,
  Menu,
  MessageSquareText,
  Moon,
  PanelLeft,
  Plus,
  RefreshCw,
  Square,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ActionBarPrimitive,
  AssistantRuntimeProvider,
  MessagePrimitive,
  ThreadPrimitive,
  useAui,
  useAuiState,
  useLocalRuntime,
  type AssistantState,
  type ChatModelAdapter,
  type TextMessagePartProps,
} from "@assistant-ui/react";
import { ModelPicker, PriceBadge } from "@/components/model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { DOCS_URL, getModel, isPaid, REPO_URL, type ModelKind } from "@/lib/models";
import {
  createChatHistoryAdapter,
  createConversation,
  deleteConversation,
  getApiKey,
  loadConversations,
  saveHistory,
  upsertConversation,
  type ConversationItem,
  type ConversationMode,
  type HistoryItem,
} from "@/lib/storage";
import { cn } from "@/lib/utils";
import { useShell } from "@/lib/use-shell";

type Drafts = Record<ConversationMode, string>;
type Models = Record<ConversationMode, string>;
type ImageParams = { size: string; ratio: string; referenceUrl: string };
type VideoParams = { size: string; ratio: string; seconds: string; firstFrame: string; lastFrame: string };
type ImageResponse = { data?: Array<{ url?: string | null; b64_json?: string | null }> };
type VideoTask = {
  id?: string;
  task_id?: string;
  video_id?: string;
  status: string;
  progress?: number;
  url?: string | null;
  video_url?: string | null;
  remixed_from_video_id?: string | null;
  metadata?: { url?: string | null; video_url?: string | null };
  error?: { message?: string } | string;
};
type ImageResult = { id: string; model: string; prompt: string; url: string; createdAt: string; params: ImageParams };
type VideoResult = { id: string; model: string; prompt: string; task: VideoTask; createdAt: string; params: VideoParams };

const defaultDrafts: Drafts = { text: "", image: "", video: "" };
const defaultModels: Models = { text: "agnes-3.0-flash", image: "agnes-image-2.5-flash", video: "agnes-video-v2.0" };
const defaultImageParams: ImageParams = { size: "1K", ratio: "1:1", referenceUrl: "" };
const defaultVideoParams: VideoParams = { size: "720P", ratio: "16:9", seconds: "5", firstFrame: "", lastFrame: "" };
const PROJECT_REPO_URL = "https://github.com/Galileo01/agnes-studio";
const actionButtonClassName = "h-8 gap-1.5 px-2.5 text-[13px] font-medium leading-none";
const actionLabelClassName = "text-[13px] font-medium leading-none";
const actionIconClassName = "size-3.5 shrink-0";
const modeMeta: Record<ConversationMode, { label: string; icon: typeof MessageSquareText; placeholder: string; empty: string }> = {
  text: { label: "文本", icon: MessageSquareText, placeholder: "给 Agnes 发送消息...", empty: "今天想让 Agnes 帮你做什么？" },
  image: { label: "图像", icon: FileImage, placeholder: "描述你想生成的画面...", empty: "描述一个画面，生成结果会出现在这里。" },
  video: { label: "视频", icon: Film, placeholder: "描述你想生成的视频镜头...", empty: "描述一个镜头，视频任务会出现在这里。" },
};
const isNewChatView = (s: AssistantState) => s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading);

function toApiMessages(messages: Parameters<ChatModelAdapter["run"]>[0]["messages"]) {
  return messages.map((message) => ({ role: message.role, content: message.content.filter((part) => part.type === "text").map((part) => part.text).join("\n") }));
}

async function* streamAgnes(response: Response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || `请求失败（${response.status}）`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("服务未返回可读取的数据流");
  const decoder = new TextDecoder();
  let buffer = "", fullText = "";
  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:") || trimmed === "data: [DONE]") continue;
      try {
        const data = JSON.parse(trimmed.slice(5).trim()) as { choices?: Array<{ delta?: { content?: string } }> };
        fullText += data.choices?.[0]?.delta?.content || "";
        yield { content: [{ type: "text" as const, text: fullText }] };
      } catch { /* stream chunks can split JSON lines */ }
    }
    if (done) break;
  }
}

function ChatRuntime({ conversationId, model, children }: { conversationId: string; model: string; children: ReactNode }) {
  const history = useMemo(() => createChatHistoryAdapter(conversationId), [conversationId]);
  const adapter = useMemo<ChatModelAdapter>(() => ({
    async *run({ messages, abortSignal }) {
      const key = getApiKey();
      if (!key) throw new Error("请先配置 AgnesAI API Key");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Agnes-API-Key": key },
        body: JSON.stringify({ model, messages: toApiMessages(messages), stream: true }),
        signal: abortSignal,
      });
      yield* streamAgnes(response);
    },
  }), [model]);
  const runtime = useLocalRuntime(adapter, { adapters: { history } });
  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>;
}

function readInitialMode(search: string): ConversationMode {
  const mode = new URLSearchParams(search).get("mode");
  return mode === "image" || mode === "video" ? mode : "text";
}

function resolveInitialSession(search: string, initialMode: ConversationMode) {
  const stored = loadConversations();
  const conversationId = new URLSearchParams(search).get("conversation");
  const matched = conversationId ? stored.find((item) => item.id === conversationId) : undefined;
  if (matched) return { conversations: stored, active: matched };
  return { conversations: stored, active: createDraftConversation(initialMode) };
}

function createDraftConversation(mode: ConversationMode = "text") {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: "新会话", mode, createdAt: now, updatedAt: now };
}

export function ChatPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialMode = readInitialMode(location.search);
  const [initialSession] = useState(() => resolveInitialSession(location.search, initialMode));
  const [conversations, setConversations] = useState<ConversationItem[]>(initialSession.conversations);
  const [activeId, setActiveId] = useState(initialSession.active.id);
  const [activeMode, setActiveMode] = useState<ConversationMode>(initialSession.active.mode);
  const [drafts, setDrafts] = useState<Drafts>(defaultDrafts);
  const [models, setModels] = useState<Models>(defaultModels);
  const [imageParams, setImageParams] = useState<ImageParams>(defaultImageParams);
  const [videoParams, setVideoParams] = useState<VideoParams>(defaultVideoParams);
  const [imageResults, setImageResults] = useState<ImageResult[]>(() => loadConversationResults<ImageResult>(activeId, "image"));
  const [videoResults, setVideoResults] = useState<VideoResult[]>(() => loadConversationResults<VideoResult>(activeId, "video"));
  const [imageLoading, setImageLoading] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [videoError, setVideoError] = useState("");
  const { hasKey, openKeyDialog, dark, setDark } = useShell();
  const activeConversation = conversations.find((item) => item.id === activeId) ?? { id: activeId, title: "新会话", mode: activeMode, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };

  useEffect(() => {
    const conversation = loadConversations().find((item) => item.id === activeId) ?? conversations.find((item) => item.id === activeId);
    if (conversation) setActiveMode(conversation.mode);
    setImageResults(loadConversationResults<ImageResult>(activeId, "image"));
    setVideoResults(loadConversationResults<VideoResult>(activeId, "video"));
    setImageError("");
    setVideoError("");
  }, [activeId]);

  const refreshConversations = () => setConversations(loadConversations());
  const updateConversation = (patch: Partial<ConversationItem>) => {
    const next = { ...activeConversation, ...patch, updatedAt: new Date().toISOString() };
    upsertConversation(next);
    setConversationUrl(next.id, next.mode, true);
    refreshConversations();
  };
  const updateDraft = (mode: ConversationMode, value: string) => setDrafts((current) => ({ ...current, [mode]: value }));
  const updateModel = (mode: ConversationMode, value: string) => setModels((current) => ({ ...current, [mode]: value }));
  const setConversationUrl = (id: string, mode: ConversationMode, replace = false) => navigate(`/?conversation=${encodeURIComponent(id)}&mode=${mode}`, { replace });
  const switchMode = (mode: ConversationMode) => {
    setActiveMode(mode);
    if (!conversations.some((item) => item.id === activeId)) navigate(`/?mode=${mode}`, { replace: true });
  };
  const startConversation = () => {
    const next = createDraftConversation(activeMode);
    setActiveId(next.id);
    setActiveMode(next.mode);
    navigate(`/?mode=${next.mode}`);
    setDrafts(defaultDrafts);
    setImageParams(defaultImageParams);
    setVideoParams(defaultVideoParams);
    setImageResults([]);
    setVideoResults([]);
    refreshConversations();
  };
  const removeConversation = (id: string) => {
    deleteConversation(id);
    const rest = loadConversations();
    setConversations(rest);
    if (id !== activeId) return;
    const next = rest[0] ?? createDraftConversation("text");
    setActiveId(next.id);
    setActiveMode(next.mode);
    if (rest[0]) setConversationUrl(next.id, next.mode, true);
    else navigate("/");
    setDrafts(defaultDrafts);
    setImageParams(defaultImageParams);
    setVideoParams(defaultVideoParams);
    setImageResults([]);
    setVideoResults([]);
  };

  return (
    <ChatRuntime key={activeId} conversationId={activeId} model={models.text}>
      <ConversationWorkspace
        activeMode={activeMode}
        setActiveMode={switchMode}
        conversations={conversations}
        activeConversation={activeConversation}
        onNew={startConversation}
        onSelect={(item) => { setActiveId(item.id); setActiveMode(item.mode); setConversationUrl(item.id, item.mode); }}
        onDelete={removeConversation}
        dark={dark}
        setDark={setDark}
        hasKey={hasKey}
        openKeyDialog={openKeyDialog}
        drafts={drafts}
        updateDraft={updateDraft}
        models={models}
        updateModel={updateModel}
        imageParams={imageParams}
        setImageParams={setImageParams}
        videoParams={videoParams}
        setVideoParams={setVideoParams}
        imageResults={imageResults}
        videoResults={videoResults}
        imageLoading={imageLoading}
        videoLoading={videoLoading}
        imageError={imageError}
        videoError={videoError}
        onPromptSubmitted={(prompt, mode) => updateConversationAfterSubmit(activeConversation, prompt, mode, updateConversation)}
        onVideoTaskUpdate={(resultId, task) => {
          const next = videoResults.map((item) => item.id === resultId ? { ...item, task } : item);
          setVideoResults(next);
          saveConversationResults(activeId, "video", next);
        }}
        submitImage={async (snapshot) => {
          setImageLoading(true);
          setImageError("");
          try {
            const extra_body: Record<string, unknown> = { response_format: snapshot.params.referenceUrl ? "url" : "url" };
            if (snapshot.params.referenceUrl) extra_body.image = [snapshot.params.referenceUrl];
            const data = await apiFetch<ImageResponse>("/api/images", { method: "POST", body: JSON.stringify({ model: snapshot.model, prompt: snapshot.prompt, size: snapshot.params.size, ratio: snapshot.params.ratio, extra_body }) });
            const item = data.data?.[0];
            const url = item?.url || (item?.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
            if (!url) throw new Error("生成成功，但响应中没有可用图片");
            const result = { id: crypto.randomUUID(), model: snapshot.model, prompt: snapshot.prompt, url, createdAt: new Date().toISOString(), params: snapshot.params };
            const next = [...imageResults, result].slice(-12);
            setImageResults(next);
            saveConversationResults(activeId, "image", next);
            saveHistory({ id: result.id, kind: "image", model: snapshot.model, prompt: snapshot.prompt, createdAt: result.createdAt, status: "completed", url, options: snapshot.params });
            updateConversationAfterSubmit(activeConversation, snapshot.prompt, "image", updateConversation);
            return true;
          } catch (cause) {
            setImageError(cause instanceof Error ? cause.message : "图像生成失败");
            return false;
          } finally {
            setImageLoading(false);
          }
        }}
        submitVideo={async (snapshot) => {
          setVideoLoading(true);
          setVideoError("");
          try {
            const modern = snapshot.model !== "agnes-video-v2.0";
            const requestParams = snapshot.model === "agnes-video-2.5-flash" ? { ...snapshot.params, size: "720P" } : snapshot.params;
            const body = modern
              ? { model: snapshot.model, prompt: snapshot.prompt, mode: "keyframe", seconds: requestParams.seconds, size: requestParams.size, aspect_ratio: requestParams.ratio, first_frame: requestParams.firstFrame || undefined, last_frame: requestParams.lastFrame || undefined }
              : { model: snapshot.model, prompt: snapshot.prompt, width: snapshot.params.ratio === "9:16" ? 768 : 1152, height: snapshot.params.ratio === "9:16" ? 1152 : 768, num_frames: Number(snapshot.params.seconds) * 24 + 1, frame_rate: 24, image: snapshot.params.firstFrame || undefined };
            const task = await apiFetch<VideoTask>("/api/videos", { method: "POST", body: JSON.stringify(body) });
            const videoId = getVideoId(task);
            if (!videoId) throw new Error("视频任务创建成功，但响应中没有可用的视频 ID");
            const normalizedTask = { ...task, video_id: videoId };
            const result = { id: videoId, model: snapshot.model, prompt: snapshot.prompt, task: normalizedTask, createdAt: new Date().toISOString(), params: requestParams };
            const next = [...videoResults, result].slice(-12);
            setVideoResults(next);
            saveConversationResults(activeId, "video", next);
            saveHistory({ id: result.id, kind: "video", model: snapshot.model, prompt: snapshot.prompt, createdAt: result.createdAt, status: task.status, url: getVideoUrl(normalizedTask), videoId, options: snapshot.params });
            updateConversationAfterSubmit(activeConversation, snapshot.prompt, "video", updateConversation);
            return true;
          } catch (cause) {
            setVideoError(cause instanceof Error ? cause.message : "视频任务创建失败");
            return false;
          } finally {
            setVideoLoading(false);
          }
        }}
      />
    </ChatRuntime>
  );
}

function ConversationWorkspace(props: {
  activeMode: ConversationMode;
  setActiveMode: (mode: ConversationMode) => void;
  conversations: ConversationItem[];
  activeConversation: ConversationItem;
  onNew: () => void;
  onSelect: (item: ConversationItem) => void;
  onDelete: (id: string) => void;
  dark: boolean;
  setDark: (value: boolean) => void;
  hasKey: boolean;
  openKeyDialog: () => void;
  drafts: Drafts;
  updateDraft: (mode: ConversationMode, value: string) => void;
  models: Models;
  updateModel: (mode: ConversationMode, value: string) => void;
  imageParams: ImageParams;
  setImageParams: (value: ImageParams) => void;
  videoParams: VideoParams;
  setVideoParams: (value: VideoParams) => void;
  imageResults: ImageResult[];
  videoResults: VideoResult[];
  imageLoading: boolean;
  videoLoading: boolean;
  imageError: string;
  videoError: string;
  onPromptSubmitted: (prompt: string, mode: ConversationMode) => void;
  onVideoTaskUpdate: (resultId: string, task: VideoTask) => void;
  submitImage: (snapshot: { model: string; prompt: string; params: ImageParams }) => Promise<boolean>;
  submitVideo: (snapshot: { model: string; prompt: string; params: VideoParams }) => Promise<boolean>;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#1d1d1b]">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex flex-col border-r border-black/[.06] bg-[#f7f7f5] transition-[width,transform] dark:border-white/10 dark:bg-[#171716] md:static md:translate-x-0", collapsed ? "md:w-[56px]" : "w-[260px]", sidebarOpen ? "translate-x-0" : "-translate-x-full")}>
        <div className={cn("flex h-14 items-center gap-2", collapsed ? "justify-center px-2" : "px-4")}>
          <Logo />
          {!collapsed && <span className="text-sm font-semibold">Agnes Studio</span>}
          <button className="ml-auto rounded-lg p-2 text-neutral-500 hover:bg-black/[.04] md:hidden" onClick={() => setSidebarOpen(false)} aria-label="关闭侧栏"><X className="size-4" /></button>
        </div>
        <div className={cn(collapsed ? "px-2" : "px-3")}>
          <button onClick={props.onNew} className={cn("flex h-11 w-full items-center gap-2 rounded-xl bg-white text-sm font-medium shadow-sm ring-1 ring-black/[.06] hover:bg-neutral-50 dark:bg-white/[.07] dark:ring-white/10 dark:hover:bg-white/[.1]", collapsed ? "justify-center px-0" : "px-3")} title="新会话"><Plus className="size-4" />{!collapsed && "新会话"}</button>
        </div>
        <div className={cn("mt-5 flex-1 overflow-y-auto", collapsed ? "px-2" : "px-3")}>
          {!collapsed && <p className="mb-2 px-2 text-xs font-medium text-neutral-400">最近</p>}
          <div className="space-y-1">
            {props.conversations.map((item) => (
              <div key={item.id} className={cn("group flex items-center rounded-xl", item.id === props.activeConversation.id ? "bg-black/[.055] dark:bg-white/[.08]" : "hover:bg-black/[.035] dark:hover:bg-white/[.05]")}>
                <button onClick={() => { props.onSelect(item); setSidebarOpen(false); }} className={cn("min-w-0 flex-1 text-left", collapsed ? "px-0 py-2" : "px-3 py-2")} title={item.title}>
                  {collapsed ? <span className="mx-auto block size-2 rounded-full bg-neutral-400" /> : <><div className="truncate text-sm">{item.title}</div><div className="mt-0.5 text-[11px] text-neutral-400">{modeMeta[item.mode].label} · {new Date(item.updatedAt).toLocaleDateString("zh-CN")}</div></>}
                </button>
                {!collapsed && <button onClick={(event) => { event.stopPropagation(); props.onDelete(item.id); }} className="mr-1 rounded-lg p-2 text-neutral-300 opacity-0 hover:bg-black/[.05] hover:text-red-500 group-hover:opacity-100" aria-label="删除会话"><Trash2 className="size-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
        <div className={cn("space-y-2 border-t border-black/[.06] p-3 dark:border-white/10", collapsed && "px-2")}>
          <button onClick={props.openKeyDialog} className={cn("flex w-full items-center gap-3 rounded-xl py-2 text-left hover:bg-black/[.04] dark:hover:bg-white/[.06]", collapsed ? "justify-center px-0" : "px-3")} title="API Key">
            <KeyRound className="size-4 text-neutral-400" />
            {!collapsed && <span className="min-w-0 flex-1 text-xs font-medium">{props.hasKey ? "已连接 API Key" : "连接 API Key"}</span>}
            <span className={cn("size-1.5 rounded-full", props.hasKey ? "bg-[#2fbf71]" : "bg-neutral-300")} />
          </button>
          <div className="flex items-center justify-between px-1">
            <DocsMenu />
            <a href={PROJECT_REPO_URL} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-neutral-500 hover:bg-black/[.04] hover:text-neutral-900 dark:hover:bg-white/[.06] dark:hover:text-white" title="项目 GitHub" aria-label="项目 GitHub"><GitHubMark className="size-4" /></a>
            <button onClick={() => props.setDark(!props.dark)} className="rounded-lg p-2 text-neutral-500 hover:bg-black/[.04] hover:text-neutral-900 dark:hover:bg-white/[.06] dark:hover:text-white" aria-label="切换主题">{props.dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</button>
          </div>
        </div>
      </aside>
      {sidebarOpen && <button className="fixed inset-0 z-30 bg-black/35 md:hidden" onClick={() => setSidebarOpen(false)} aria-label="关闭遮罩" />}
      <main className="flex min-w-0 flex-1 flex-col">
        <Header title={props.activeConversation.title} onOpenSidebar={() => setSidebarOpen(true)} onToggleSidebar={() => setCollapsed(!collapsed)} />
        <ThreadArea {...props} />
      </main>
    </div>
  );
}

function Header({ title, onOpenSidebar, onToggleSidebar }: { title: string; onOpenSidebar: () => void; onToggleSidebar: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 px-3 md:px-4">
      <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={onOpenSidebar} aria-label="打开侧栏"><Menu className="size-4" /></Button>
      <Button variant="ghost" size="icon" className="hidden size-8 md:inline-flex" onClick={onToggleSidebar} aria-label="收起或展开侧栏"><PanelLeft className="size-4" /></Button>
      <span className="min-w-0 truncate text-sm font-medium">{title}</span>
    </header>
  );
}

function ThreadArea(props: Parameters<typeof ConversationWorkspace>[0]) {
  const isEmpty = useAuiState(isNewChatView);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden">
      <ThreadPrimitive.Root className="flex min-h-0 flex-1 flex-col">
        <ThreadPrimitive.Viewport turnAnchor="top" className={cn("flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pt-4", isEmpty && props.activeMode === "text" && "justify-center")}>
          {props.activeMode === "text" ? <TextThread /> : props.activeMode === "image" ? <ImageResults results={props.imageResults} loading={props.imageLoading} error={props.imageError} /> : <VideoResults results={props.videoResults} loading={props.videoLoading} error={props.videoError} onTaskUpdate={props.onVideoTaskUpdate} />}
          <ThreadPrimitive.ViewportFooter className={cn("mx-auto flex w-full max-w-[44rem] flex-col gap-3 pb-5 pt-6", props.activeMode === "text" && !(isEmpty && props.activeMode === "text") && "sticky bottom-0 mt-auto bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#1d1d1b] dark:via-[#1d1d1b]/95", props.activeMode !== "text" && "sticky bottom-0 mt-auto")}>
            <ThreadScrollToBottom />
            {!props.hasKey && <button onClick={props.openKeyDialog} className="rounded-xl bg-[#f2fac7] px-3 py-2 text-xs font-medium text-[#596000] hover:bg-[#ebf89b]">连接 AgnesAI API Key 后即可生成</button>}
            <ModeComposer {...props} />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    </div>
  );
}

function ModeComposer(props: Parameters<typeof ConversationWorkspace>[0]) {
  const aui = useAui();
  const prompt = props.drafts[props.activeMode];
  const currentModel = props.models[props.activeMode];
  const model = getModel(currentModel);
  const running = useAuiState((s) => s.thread.isRunning);
  const busy = props.activeMode === "text" ? running : props.activeMode === "image" ? props.imageLoading : props.videoLoading;
  const canSend = prompt.trim() && !busy;
  const submit = async () => {
    if (!canSend) return;
    if (!props.hasKey) return props.openKeyDialog();
    if (model && isPaid(model)) {
      const accepted = window.confirm("这是收费模型，生成将按 AgnesAI 官方价格计费。确认继续？");
      if (!accepted) return;
    }
    const snapshot = { mode: props.activeMode, model: currentModel, prompt: prompt.trim() };
    if (snapshot.mode === "text") {
      props.onPromptSubmitted(snapshot.prompt, "text");
      aui.thread.append({ content: [{ type: "text", text: snapshot.prompt }] });
      props.updateDraft("text", "");
      return;
    }
    if (snapshot.mode === "image") {
      props.updateDraft("image", "");
      const ok = await props.submitImage({ model: snapshot.model, prompt: snapshot.prompt, params: { ...props.imageParams } });
      if (!ok) props.updateDraft("image", snapshot.prompt);
      return;
    }
    props.updateDraft("video", "");
    const ok = await props.submitVideo({ model: snapshot.model, prompt: snapshot.prompt, params: { ...props.videoParams } });
    if (!ok) props.updateDraft("video", snapshot.prompt);
  };
  const clear = () => props.updateDraft(props.activeMode, "");

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-black/[.08] bg-white p-2 transition focus-within:border-neutral-400 dark:border-white/10 dark:bg-[#282826]", props.activeMode === "text" ? "shadow-[0_8px_28px_rgba(0,0,0,.08)]" : "shadow-[0_4px_18px_rgba(0,0,0,.06)]")}>
      <textarea
        value={prompt}
        onChange={(event) => props.updateDraft(props.activeMode, event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void submit();
          }
        }}
        placeholder={modeMeta[props.activeMode].placeholder}
        rows={2}
        className="block max-h-36 min-h-[48px] w-full resize-none bg-transparent px-3 py-2.5 text-sm leading-6 outline-none placeholder:text-neutral-400"
      />
      {props.activeMode === "image" && <ImageParamsPanel value={props.imageParams} onChange={props.setImageParams} />}
      {props.activeMode === "video" && <VideoParamsPanel value={props.videoParams} onChange={props.setVideoParams} model={currentModel} />}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ModeSwitch value={props.activeMode} onChange={props.setActiveMode} />
          <ModelPicker kind={props.activeMode as ModelKind} value={currentModel} onChange={(value) => props.updateModel(props.activeMode, value)} compact />
          {model && <PriceBadge status={model.priceStatus} compact />}
        </div>
        <div className="flex items-center gap-1">
          {prompt && <Button size="icon" variant="ghost" className="size-7 rounded-full text-neutral-500" onClick={clear} aria-label="清空输入"><X className="size-3.5" /></Button>}
          <Button size="icon" className="size-7 rounded-full" disabled={!canSend} onClick={submit} aria-label={busy ? "生成中" : "发送"}>
            {busy ? <Square className="size-3 fill-current" /> : <ArrowUp className="size-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ModeSwitch({ value, onChange }: { value: ConversationMode; onChange: (mode: ConversationMode) => void }) {
  return (
    <div className="flex rounded-full border border-black/[.06] bg-white p-0.5 dark:border-white/10 dark:bg-white/[.04]">
      {(Object.keys(modeMeta) as ConversationMode[]).map((mode) => {
        const Icon = modeMeta[mode].icon;
        return <button key={mode} onClick={() => onChange(mode)} className={cn("flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[13px] transition", value === mode ? "bg-neutral-50 shadow-sm dark:bg-white/[.14]" : "text-neutral-500 hover:text-neutral-900 dark:hover:text-white")}><Icon className="size-3.5" />{modeMeta[mode].label}</button>;
      })}
    </div>
  );
}

function ImageParamsPanel({ value, onChange }: { value: ImageParams; onChange: (value: ImageParams) => void }) {
  return (
    <div className="grid gap-2 border-t border-black/[.06] px-2 py-2.5 dark:border-white/10 sm:grid-cols-[104px_104px_minmax(0,1fr)]">
      <Select value={value.size} onValueChange={(size) => onChange({ ...value, size })}><SelectTrigger className="h-9 rounded-xl text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["1K", "2K", "3K", "4K"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={value.ratio} onValueChange={(ratio) => onChange({ ...value, ratio })}><SelectTrigger className="h-9 rounded-xl text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Input className="h-9 rounded-xl text-[13px]" value={value.referenceUrl} onChange={(event) => onChange({ ...value, referenceUrl: event.target.value })} placeholder="参考图 URL（可选）" />
    </div>
  );
}

function VideoParamsPanel({ value, onChange, model }: { value: VideoParams; onChange: (value: VideoParams) => void; model: string }) {
  const flash = model === "agnes-video-2.5-flash";
  return (
    <div className="grid gap-2 border-t border-black/[.06] px-2 py-2.5 dark:border-white/10 sm:grid-cols-[96px_104px_104px_minmax(0,1fr)]">
      <Select value={value.seconds} onValueChange={(seconds) => onChange({ ...value, seconds })}><SelectTrigger className="h-9 rounded-xl text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["4", "5", "6", "8", "10", "12"].map((item) => <SelectItem key={item} value={item}>{item} 秒</SelectItem>)}</SelectContent></Select>
      <Select value={value.ratio} onValueChange={(ratio) => onChange({ ...value, ratio })}><SelectTrigger className="h-9 rounded-xl text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["16:9", "9:16", "1:1", "4:3", "3:4"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={flash ? "720P" : value.size} onValueChange={(size) => onChange({ ...value, size })} disabled={flash}><SelectTrigger className="h-9 rounded-xl text-[13px]"><SelectValue /></SelectTrigger><SelectContent>{["720P", "1080P", "1K", "2K"].map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input className="h-9 rounded-xl text-[13px]" value={value.firstFrame} onChange={(event) => onChange({ ...value, firstFrame: event.target.value })} placeholder="首帧 URL（可选）" />
        <Input className="h-9 rounded-xl text-[13px]" value={value.lastFrame} onChange={(event) => onChange({ ...value, lastFrame: event.target.value })} placeholder="尾帧 URL（可选）" />
      </div>
    </div>
  );
}

function TextThread() {
  const aui = useAui();
  const running = useAuiState((s) => s.thread.isRunning);
  return (
    <>
      <ThreadPrimitive.Empty>
        <div className="mx-auto mb-5 flex w-full max-w-[44rem] flex-col items-center px-4 text-center">
          <h1 className="max-w-xs text-xl font-medium tracking-tight sm:max-w-none sm:text-2xl">今天想让 Agnes 帮你做什么？</h1>
          <div className="mt-8 grid w-full max-w-xs grid-cols-2 gap-2 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
            {suggestions.map((item) => <button key={item.prompt} onClick={() => aui.thread.append({ content: [{ type: "text", text: item.prompt }] })} className="min-w-0 truncate rounded-full border border-black/[.08] px-3.5 py-1.5 text-sm hover:bg-neutral-100 dark:border-white/10 dark:hover:bg-white/[.06]">{item.label}</button>)}
          </div>
        </div>
      </ThreadPrimitive.Empty>
      <div className="mb-10 flex flex-col gap-6 empty:hidden">
        <ThreadPrimitive.Messages components={{ UserMessage, AssistantMessage }} />
        {running && <AssistantWorkingMessage />}
      </div>
    </>
  );
}

function ImageResults({ results, loading, error }: { results: ImageResult[]; loading: boolean; error: string }) {
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-4 py-8">
      {!results.length && !loading && <EmptyMode mode="image" />}
      {error && <ErrorBox message={error} />}
      {results.map((item) => <ImageResultCard key={item.id} item={item} />)}
      {loading && <WorkingCard label="图像生成中" text="大尺寸图片可能需要几十秒。" />}
    </div>
  );
}

function ImageResultCard({ item }: { item: ImageResult }) {
  return (
    <div className="rounded-2xl border border-black/[.07] bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[.035]">
      <img src={item.url} alt={item.prompt} className="max-h-[620px] w-full rounded-xl bg-neutral-100 object-contain dark:bg-black" />
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <p className="text-sm leading-6">{item.prompt}</p>
          <p className="mt-1 text-xs text-neutral-400">{item.model} · {item.params.size} · {item.params.ratio}</p>
        </div>
        <ResultActions prompt={item.prompt} url={item.url} urlLabel="复制图片链接" openLabel="打开" />
      </div>
    </div>
  );
}

function VideoResults({ results, loading, error, onTaskUpdate }: { results: VideoResult[]; loading: boolean; error: string; onTaskUpdate: (resultId: string, task: VideoTask) => void }) {
  return (
    <div className="mx-auto flex w-full max-w-[52rem] flex-1 flex-col gap-4 py-8">
      {!results.length && !loading && <EmptyMode mode="video" />}
      {error && <ErrorBox message={error} />}
      {results.map((item) => <VideoResultCard key={item.id} item={item} onTaskUpdate={onTaskUpdate} />)}
      {loading && <WorkingCard label="视频任务提交中" text="任务创建后会显示 task id 和预览状态。" />}
    </div>
  );
}

function VideoResultCard({ item, onTaskUpdate }: { item: VideoResult; onTaskUpdate: (resultId: string, task: VideoTask) => void }) {
  const [task, setTask] = useState(item.task);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const refresh = async () => {
    const videoId = getVideoId(task);
    if (!videoId) {
      setError("视频任务缺少可查询的 ID");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const latest = await apiFetch<VideoTask>(`/api/videos/${encodeURIComponent(videoId)}?model=${encodeURIComponent(item.model)}`);
      const normalized = { ...latest, video_id: getVideoId(latest) || videoId };
      setTask(normalized);
      onTaskUpdate(item.id, normalized);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "查询视频状态失败");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if ((task.status === "completed" && getVideoUrl(task)) || task.status === "failed" || !getVideoId(task)) return;
    const timer = window.setInterval(() => { void refresh(); }, 3500);
    return () => window.clearInterval(timer);
  }, [task.status, item.id, item.model]);
  const videoId = getVideoId(task);
  const videoUrl = getVideoUrl(task);
  return (
    <div className="rounded-2xl border border-black/[.07] bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[.035]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0"><p className="text-sm font-medium">{statusLabel(task.status)}</p><p className="mt-1 max-w-full break-all text-xs leading-5 text-neutral-400">ID: {videoId || "未知"} · {item.model}</p></div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={loading}><RefreshCw className={cn("size-3.5", loading && "animate-spin")} />刷新</Button>
      </div>
      {error && <div className="mt-3"><ErrorBox message={error} /></div>}
      {videoUrl ? <video src={videoUrl} controls className="mt-4 max-h-[620px] w-full rounded-xl bg-black" /> : <div className="mt-4 rounded-xl bg-neutral-100 p-8 text-center text-sm text-neutral-500 dark:bg-black/30">等待 AgnesAI 生成完成{typeof task.progress === "number" ? ` · ${task.progress}%` : ""}</div>}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm leading-6">{item.prompt}</p>
          <p className="mt-1 text-xs text-neutral-400">{item.params.seconds} 秒 · {item.params.ratio} · {item.params.size}</p>
        </div>
        <ResultActions prompt={item.prompt} url={videoUrl} urlLabel="复制视频链接" openLabel="打开" />
      </div>
    </div>
  );
}

function ResultActions({ prompt, url, urlLabel, openLabel }: { prompt: string; url: string; urlLabel: string; openLabel: string }) {
  const [copied, setCopied] = useState<"prompt" | "url" | null>(null);
  const copy = async (kind: "prompt" | "url", value: string) => {
    await copyToClipboard(value);
    setCopied(kind);
    window.setTimeout(() => setCopied((current) => (current === kind ? null : current)), 1400);
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" className={actionButtonClassName} onClick={() => void copy("prompt", prompt)}>
        {copied === "prompt" ? <Check className={actionIconClassName} /> : <Copy className={actionIconClassName} />}
        <span className={actionLabelClassName}>复制消息</span>
      </Button>
      <Button variant="outline" size="sm" className={actionButtonClassName} onClick={() => void copy("url", url)} disabled={!url}>
        {copied === "url" ? <Check className={actionIconClassName} /> : <Copy className={actionIconClassName} />}
        <span className={actionLabelClassName}>{urlLabel}</span>
      </Button>
      <Button asChild variant="outline" size="sm" className={cn(actionButtonClassName, !url && "pointer-events-none opacity-50")}>
        <a href={url || "#"} target="_blank" rel="noreferrer">
          <ExternalLink className={actionIconClassName} />
          <span className={actionLabelClassName}>{openLabel}</span>
        </a>
      </Button>
    </div>
  );
}

function EmptyMode({ mode }: { mode: Exclude<ConversationMode, "text"> }) {
  const Icon = modeMeta[mode].icon;
  return <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-neutral-400"><Icon className="size-10 opacity-35" /><p className="mt-4 text-sm">{modeMeta[mode].empty}</p></div>;
}

function WorkingCard({ label, text }: { label: string; text: string }) {
  return <div className="rounded-2xl border border-black/[.07] bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-white/[.035]"><RefreshCw className="mx-auto size-5 animate-spin text-neutral-500" /><p className="mt-3 text-sm font-medium">{label}</p><p className="mt-1 text-xs text-neutral-400">{text}</p></div>;
}

function ErrorBox({ message }: { message: string }) {
  return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{message}</div>;
}

function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <Button variant="outline" size="icon" className="absolute -top-10 left-1/2 size-8 -translate-x-1/2 rounded-full disabled:invisible" aria-label="滚动到底部"><ArrowDown className="size-4" /></Button>
    </ThreadPrimitive.ScrollToBottom>
  );
}

function UserMessage() {
  return <MessagePrimitive.Root className="mx-auto grid w-full max-w-[44rem] grid-cols-[1fr_auto] gap-y-2 px-2"><div className="col-start-2 w-fit min-w-12 max-w-[85%] whitespace-pre-wrap rounded-2xl bg-neutral-100 px-4 py-2 text-sm leading-6 dark:bg-white/10"><MessagePrimitive.Parts /></div></MessagePrimitive.Root>;
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="group mx-auto w-full max-w-[44rem] px-2">
      <div className="prose-chat text-sm text-neutral-800 dark:text-neutral-200">
        <MessagePrimitive.Parts components={{ Text: MarkdownPart }} />
      </div>
      <ActionBarPrimitive.Root hideWhenRunning className="mt-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <ActionBarPrimitive.Copy asChild>
          <Button variant="ghost" size="sm" className={actionButtonClassName}>
            <Copy className={actionIconClassName} />
            <span className={actionLabelClassName}>复制</span>
          </Button>
        </ActionBarPrimitive.Copy>
        <ActionBarPrimitive.Reload asChild>
          <Button variant="ghost" size="sm" className={actionButtonClassName}>
            <RefreshCw className={actionIconClassName} />
            <span className={actionLabelClassName}>重试</span>
          </Button>
        </ActionBarPrimitive.Reload>
      </ActionBarPrimitive.Root>
    </MessagePrimitive.Root>
  );
}

function AssistantWorkingMessage() {
  return (
    <div className="mx-auto flex w-full max-w-[44rem] items-center gap-3 px-2 text-sm text-neutral-500 dark:text-neutral-400">
      <span className="grid size-5 grid-cols-3 gap-0.5" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="size-1 rounded-full bg-current opacity-35 animate-pulse"
            style={{ animationDelay: `${index * 70}ms` }}
          />
        ))}
      </span>
      <span>Agnes 正在连接</span>
    </div>
  );
}

function MarkdownPart({ text }: TextMessagePartProps) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>;
}

function Logo() {
  return <div className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[#e8ff59] text-[13px] font-black tracking-tight text-black">AG</div>;
}

function DocsMenu() {
  return (
    <div className="group/docs relative py-2">
      <button className="rounded-lg p-2 text-neutral-500 hover:bg-black/[.04] hover:text-neutral-900 focus-visible:bg-black/[.04] focus-visible:text-neutral-900 focus-visible:outline-none dark:hover:bg-white/[.06] dark:hover:text-white dark:focus-visible:bg-white/[.06] dark:focus-visible:text-white" aria-label="AgnesAI 文档入口">
        <BookOpen className="size-4" />
      </button>
      <div className="invisible absolute bottom-full left-0 z-50 w-56 translate-y-1 rounded-xl border border-black/[.08] bg-white p-1.5 opacity-0 shadow-xl transition group-hover/docs:visible group-hover/docs:translate-y-0 group-hover/docs:opacity-100 group-focus-within/docs:visible group-focus-within/docs:translate-y-0 group-focus-within/docs:opacity-100 dark:border-white/10 dark:bg-[#252523]">
        <a href={DOCS_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-white/[.06]"><BookOpen className="size-4 text-neutral-400" /><span>AgnesAI 官网文档</span></a>
        <a href={REPO_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-white/[.06]"><GitHubMark className="size-4 text-neutral-400" /><span>AgnesAI GitHub 仓库</span></a>
      </div>
    </div>
  );
}

function updateConversationAfterSubmit(conversation: ConversationItem, prompt: string, mode: ConversationMode, update: (patch: Partial<ConversationItem>) => void) {
  update({ mode, title: conversation.title === "新会话" ? shortTitle(prompt) : conversation.title });
}

function shortTitle(prompt: string) {
  return prompt.length > 22 ? `${prompt.slice(0, 22)}...` : prompt;
}

function getVideoId(task: VideoTask) {
  return task.video_id || task.id || task.task_id || "";
}

function getVideoUrl(task: VideoTask) {
  return task.metadata?.url || task.metadata?.video_url || task.url || task.video_url || task.remixed_from_video_id || "";
}

function loadConversationResults<T>(conversationId: string, kind: "image" | "video"): T[] {
  try { return JSON.parse(localStorage.getItem(`agnes-studio:${conversationId}:${kind}-results`) || "[]"); }
  catch { return []; }
}

function saveConversationResults<T>(conversationId: string, kind: "image" | "video", items: T[]) {
  localStorage.setItem(`agnes-studio:${conversationId}:${kind}-results`, JSON.stringify(items));
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function statusLabel(status: string) {
  return ({ queued: "任务正在排队", in_progress: "视频正在生成", completed: "视频生成完成", failed: "视频生成失败" } as Record<string, string>)[status] || `任务状态：${status}`;
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.38c.6.11.82-.26.82-.58v-2.1c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.08 1.83 2.82 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1-.32 3.3 1.23a11.44 11.44 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.9 1.23 3.22 0 4.61-2.8 5.63-5.48 5.93.43.37.82 1.1.82 2.22v3.3c0 .32.21.69.83.57A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

const suggestions = [
  { label: "解释一个技术概念", prompt: "用简单例子解释 React Server Components 的适用边界" },
  { label: "写一段产品文案", prompt: "为一款面向创作者的 AI 产品写三版首页文案" },
  { label: "分析一个想法", prompt: "帮我分析一个新产品想法应该如何验证市场需求" },
  { label: "实现一个函数", prompt: "用 TypeScript 实现一个带指数退避和取消能力的轮询函数" },
];
