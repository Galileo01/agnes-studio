import { getApiKey } from "./storage";

const AGNES_API_BASE = "https://apihub.agnes-ai.com";

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId?: string) { super(message); }
}

export async function agnesFetch(path: string, init?: RequestInit): Promise<Response> {
  const key = getApiKey();
  if (!key) throw new ApiError("请先配置 AgnesAI API Key", 401);
  const upstream = toAgnesUrl(path);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${key}`);
  headers.set("Accept", "application/json, text/event-stream");
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(upstream, { ...init, headers });
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await agnesFetch(path, init);
  if (!response.ok) throw await toApiError(response);
  return response.json() as Promise<T>;
}

function toAgnesUrl(path: string) {
  if (path === "/api/chat") return `${AGNES_API_BASE}/v1/chat/completions`;
  if (path === "/api/images") return `${AGNES_API_BASE}/v1/images/generations`;
  if (path === "/api/videos") return `${AGNES_API_BASE}/v1/videos`;
  if (path.startsWith("/api/videos/")) {
    const source = new URL(path, "https://agnes-studio.local");
    const videoId = decodeURIComponent(source.pathname.slice("/api/videos/".length));
    const model = source.searchParams.get("model") || "";
    const upstream = new URL(`${AGNES_API_BASE}/agnesapi`);
    upstream.searchParams.set("video_id", videoId);
    if (model && model !== "agnes-video-v2.0") upstream.searchParams.set("model_name", model);
    return upstream.toString();
  }
  return path;
}

async function toApiError(response: Response) {
  let detail = "";
  try {
    const data = await response.json() as { detail?: string; error?: { message?: string } | string; message?: string };
    detail = data.detail || data.message || (typeof data.error === "string" ? data.error : data.error?.message) || "";
  } catch { /* keep generic */ }
  return new ApiError(humanError(response.status, detail, response.headers.get("Retry-After") || ""), response.status, response.headers.get("X-Request-ID") || undefined);
}

function humanError(status: number, detail: string, retryAfter: string) {
  if (detail) return `AgnesAI：${detail}`;
  if (status === 401 || status === 403) return "API Key 无效、已过期，或没有该模型的访问权限";
  if (status === 404) return "模型、任务或接口不存在，请检查当前配置";
  if (status === 429) return retryAfter ? `AgnesAI 返回请求过于频繁，请 ${retryAfter} 秒后再试` : "AgnesAI 返回请求过于频繁，已超过当前账号的频率限制，请稍后再试";
  if (status >= 500) return "AgnesAI 服务暂时不可用，请稍后重试";
  return `AgnesAI 拒绝了请求（${status}）`;
}
