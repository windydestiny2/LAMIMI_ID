import { ApiError } from "./api";

const BASE = "/api";
const TOKEN_KEY = "lamimi_admin_token";

export const getAdminToken = () => localStorage.getItem(TOKEN_KEY) ?? "";
export const setAdminToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearAdminToken = () => localStorage.removeItem(TOKEN_KEY);

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getAdminToken()}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function uploadCover(file: File): Promise<{cover_url: string}> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/admin/upload-cover`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAdminToken()}` },
    body: form,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => null);
    throw new ApiError(res.status, errBody);
  }
  return (await res.json()) as { cover_url: string };
}

export const aGet = <T>(path: string) => request<T>("GET", path);
export const aPost = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
export const aPut = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
export const aPatch = <T>(path: string, body?: unknown) => request<T>("PATCH", path, body);
export const aDelete = <T>(path: string) => request<T>("DELETE", path);

export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const detail = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return detail.map((d) => d?.msg ?? "").filter(Boolean).join(" ");
  }
  return "Terjadi kesalahan. Coba lagi ya.";
}
