const KEY_STORAGE = "agnes-studio:api-key";
const REMEMBER_STORAGE = "agnes-studio:remember-key";

let memoryKey = "";

export function getApiKey() {
  return memoryKey || localStorage.getItem(KEY_STORAGE) || "";
}

export function setApiKey(key: string, remember: boolean) {
  memoryKey = key.trim();
  localStorage.setItem(REMEMBER_STORAGE, String(remember));
  if (remember && memoryKey) localStorage.setItem(KEY_STORAGE, memoryKey);
  else localStorage.removeItem(KEY_STORAGE);
  window.dispatchEvent(new Event("agnes:key-change"));
}

export function clearApiKey() {
  memoryKey = "";
  localStorage.removeItem(KEY_STORAGE);
  localStorage.removeItem(REMEMBER_STORAGE);
  window.dispatchEvent(new Event("agnes:key-change"));
}

export function remembersApiKey() {
  return localStorage.getItem(REMEMBER_STORAGE) === "true";
}

export interface HistoryItem {
  id: string;
  kind: "image" | "video";
  model: string;
  prompt: string;
  createdAt: string;
  status: string;
  url?: string;
  videoId?: string;
  options?: Record<string, unknown>;
}

export function loadHistory(kind: HistoryItem["kind"]): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem(`agnes-studio:${kind}-history`) || "[]"); }
  catch { return []; }
}

export function saveHistory(item: HistoryItem) {
  const items = loadHistory(item.kind).filter((entry) => entry.id !== item.id);
  localStorage.setItem(`agnes-studio:${item.kind}-history`, JSON.stringify([item, ...items].slice(0, 24)));
}

const CHAT_STORAGE = "agnes-studio:chat-history";
const CONVERSATIONS_STORAGE = "agnes-studio:conversations";

export type ConversationMode = "text" | "image" | "video";

export interface ConversationItem {
  id: string;
  title: string;
  mode: ConversationMode;
  createdAt: string;
  updatedAt: string;
}

export function createConversation(mode: ConversationMode = "text") {
  const now = new Date().toISOString();
  const item: ConversationItem = { id: crypto.randomUUID(), title: "新会话", mode, createdAt: now, updatedAt: now };
  saveConversations([...loadConversations(), item].slice(-30));
  return item;
}

export function loadConversations(): ConversationItem[] {
  try {
    return (JSON.parse(localStorage.getItem(CONVERSATIONS_STORAGE) || "[]") as ConversationItem[])
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }
  catch { return []; }
}

export function saveConversations(items: ConversationItem[]) {
  localStorage.setItem(CONVERSATIONS_STORAGE, JSON.stringify(items));
}

export function upsertConversation(update: ConversationItem) {
  const items = loadConversations().filter((item) => item.id !== update.id);
  saveConversations([...items, update].slice(-30));
}

export function deleteConversation(id: string) {
  saveConversations(loadConversations().filter((item) => item.id !== id));
  localStorage.removeItem(chatStorageKey(id));
  localStorage.removeItem(`agnes-studio:${id}:image-results`);
  localStorage.removeItem(`agnes-studio:${id}:video-results`);
}

function chatStorageKey(conversationId?: string) {
  return conversationId ? `agnes-studio:${conversationId}:chat-history` : CHAT_STORAGE;
}

export function createChatHistoryAdapter(conversationId?: string) {
  const storageKey = chatStorageKey(conversationId);
  const read = () => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '{"messages":[]}', (key, value) => key === "createdAt" && typeof value === "string" ? new Date(value) : value);
    } catch { return { messages: [] }; }
  };
  const write = (repository: { headId?: string | null; messages: Array<{ message: { id: string }; parentId: string | null; runConfig?: unknown }> }) => localStorage.setItem(storageKey, JSON.stringify(repository));
  const upsert = async (item: { message: { id: string }; parentId: string | null; runConfig?: unknown }) => {
    const repository = read();
    repository.messages = repository.messages.filter((entry: { message: { id: string } }) => entry.message.id !== item.message.id);
    repository.messages.push(item);
    repository.headId = item.message.id;
    write(repository);
  };
  return {
    async load() { return read(); },
    append: upsert,
    update: upsert,
    async delete(items: Array<{ message: { id: string } }>) {
      const ids = new Set(items.map((item) => item.message.id));
      const repository = read();
      repository.messages = repository.messages.filter((entry: { message: { id: string } }) => !ids.has(entry.message.id));
      repository.headId = repository.messages.at(-1)?.message.id ?? null;
      write(repository);
    },
  };
}
