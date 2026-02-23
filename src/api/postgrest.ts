import { config } from "../config";

const API_URL = config.apiUrl;

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  params?: Record<string, string>;
};

let getToken: (() => string | undefined) | null = null;

export function setTokenGetter(fn: () => string | undefined) {
  getToken = fn;
}

export async function api<T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, headers = {}, params } = opts;

  const token = getToken?.();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  let url = `${API_URL}${path}`;
  if (params) {
    const search = new URLSearchParams(params);
    url += `?${search.toString()}`;
  }

  // PostgREST: request single object with Prefer header for RPC / single-row
  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`API ${resp.status}: ${text}`);
  }

  const text = await resp.text();
  if (!text) return undefined as T;
  return JSON.parse(text);
}

export function rpc<T = unknown>(fn: string, body?: unknown): Promise<T> {
  return api<T>(`/rpc/${fn}`, {
    method: "POST",
    body: body ?? {},
    headers: { Prefer: "return=representation" },
  });
}
