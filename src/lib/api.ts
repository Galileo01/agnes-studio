import { getApiKey } from "./storage";

export class ApiError extends Error {
  constructor(message: string, public status: number, public requestId?: string) { super(message); }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const key = getApiKey();
  if (!key) throw new ApiError("请先配置 AgnesAI API Key", 401);
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Agnes-API-Key": key, ...init?.headers },
  });
  if (!response.ok) {
    let message = `请求失败（${response.status}）`;
    try { const data = await response.json() as { error?: string }; if (data.error) message = data.error; } catch { /* noop */ }
    throw new ApiError(message, response.status, response.headers.get("X-Request-ID") || undefined);
  }
  return response.json() as Promise<T>;
}
