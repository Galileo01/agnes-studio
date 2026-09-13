const API_BASE = "https://apihub.agnes-ai.com";
const ALLOWED_MODELS = new Set([
  "agnes-3.0-flash", "agnes-2.5-flash", "agnes-2.5-pro", "agnes-2.5-pro-beta", "agnes-2.0-flash", "agnes-1.5-flash",
  "agnes-image-2.5-flash", "agnes-image-2.1-flash", "agnes-image-2.0-flash",
  "agnes-video-2.5-flash", "agnes-video-v2.0", "agnes-video-2.5",
]);

type JsonRecord = Record<string, unknown>;

export default {
  async fetch(request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
    const requestId = crypto.randomUUID();

    if (request.method === "OPTIONS") return withHeaders(new Response(null, { status: 204 }), requestId);
    if (url.pathname === "/api/health") return withHeaders(Response.json({ ok: true }), requestId);

    const apiKey = request.headers.get("X-Agnes-API-Key")?.trim();
    if (!apiKey) return error("请先配置 AgnesAI API Key", 401, requestId);
    if (apiKey.length > 512) return error("API Key 格式无效", 400, requestId);

    try {
      if (url.pathname === "/api/chat" && request.method === "POST") return await proxyJson(request, apiKey, "/v1/chat/completions", "text", requestId);
      if (url.pathname === "/api/images" && request.method === "POST") return await proxyJson(request, apiKey, "/v1/images/generations", "image", requestId);
      if (url.pathname === "/api/videos" && request.method === "POST") return await proxyJson(request, apiKey, "/v1/videos", "video", requestId);
      if (url.pathname.startsWith("/api/videos/") && request.method === "GET") {
        const videoId = decodeURIComponent(url.pathname.slice("/api/videos/".length));
        const model = url.searchParams.get("model") || "";
        if (!/^video_[A-Za-z0-9_-]+$/.test(videoId)) return error("视频 ID 格式无效", 400, requestId);
        if (!ALLOWED_MODELS.has(model) || !model.includes("video")) return error("不支持的视频模型", 400, requestId);
        const upstream = new URL(`${API_BASE}/agnesapi`);
        upstream.searchParams.set("video_id", videoId);
        if (model !== "agnes-video-v2.0") upstream.searchParams.set("model_name", model);
        return await proxy(upstream.toString(), { method: "GET", headers: upstreamHeaders(apiKey) }, requestId);
      }
      return error("接口不存在", 404, requestId);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "网关请求失败";
      return error(message, 502, requestId);
    }
  },
} satisfies ExportedHandler;

async function proxyJson(request: Request, apiKey: string, upstreamPath: string, kind: "text" | "image" | "video", requestId: string) {
  const length = Number(request.headers.get("Content-Length") || "0");
  const maxBytes = kind === "image" ? 20 * 1024 * 1024 : 512 * 1024;
  if (length > maxBytes) return error("请求内容过大", 413, requestId);
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBytes) return error("请求内容过大", 413, requestId);
  let json: JsonRecord;
  try { json = JSON.parse(body) as JsonRecord; } catch { return error("请求 JSON 格式无效", 400, requestId); }
  const model = typeof json.model === "string" ? json.model : "";
  if (!ALLOWED_MODELS.has(model)) return error("不支持的模型", 400, requestId);
  if (kind === "text" && !model.match(/^agnes-(?:\d|1\.5|2\.0)/)) return error("模型类型与接口不匹配", 400, requestId);
  if (kind === "image" && !model.startsWith("agnes-image-")) return error("模型类型与接口不匹配", 400, requestId);
  if (kind === "video" && !model.startsWith("agnes-video-")) return error("模型类型与接口不匹配", 400, requestId);
  return proxy(`${API_BASE}${upstreamPath}`, { method: "POST", headers: upstreamHeaders(apiKey), body }, requestId);
}

async function proxy(url: string, init: RequestInit, requestId: string) {
  const response = await fetch(url, init);
  const headers = new Headers();
  headers.set("Content-Type", response.headers.get("Content-Type") || "application/json; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  headers.set("X-Request-ID", requestId);
  if (!response.ok) {
    const raw = await response.text();
    let upstreamMessage = "";
    try { const data = JSON.parse(raw) as { detail?: string; error?: { message?: string } | string; message?: string }; upstreamMessage = data.detail || data.message || (typeof data.error === "string" ? data.error : data.error?.message) || ""; } catch { /* keep generic */ }
    return new Response(JSON.stringify({ error: humanError(response.status, upstreamMessage), requestId }), { status: response.status, headers });
  }
  return new Response(response.body, { status: response.status, headers });
}

function upstreamHeaders(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" }; }
function error(message: string, status: number, requestId: string) { return withHeaders(Response.json({ error: message, requestId }, { status }), requestId); }
function withHeaders(response: Response, requestId: string) { const headers = new Headers(response.headers); headers.set("Cache-Control", "no-store"); headers.set("X-Request-ID", requestId); headers.set("X-Content-Type-Options", "nosniff"); headers.set("Referrer-Policy", "strict-origin-when-cross-origin"); return new Response(response.body, { status: response.status, statusText: response.statusText, headers }); }
function humanError(status: number, detail: string) {
  if (status === 401 || status === 403) return "API Key 无效、已过期，或没有该模型的访问权限";
  if (status === 404) return "模型、任务或接口不存在，请检查当前配置";
  if (status === 429) return "请求过于频繁，已达到 AgnesAI 当前账户限额，请稍后再试";
  if (status >= 500) return "AgnesAI 服务暂时不可用，请稍后重试";
  return detail ? `AgnesAI：${detail}` : `AgnesAI 拒绝了请求（${status}）`;
}
