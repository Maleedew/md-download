/** Thin client for the md download API (see /server). */

export interface VideoQuality {
  res: number;
  label: string;
  approxBytes?: number;
}
export interface AudioQuality {
  kbps: number;
  label: string;
  approxBytes?: number;
}
export interface VideoInfo {
  id: string;
  title: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  platform: string;
  webpageUrl: string;
  hasVideo: boolean;
  hasAudio: boolean;
  video: VideoQuality[];
  audio: AudioQuality[];
}
export type Kind = "mp4" | "mp3";
export interface JobState {
  id: string;
  kind: Kind;
  status: "queued" | "running" | "done" | "error";
  stage: "queued" | "downloading" | "processing" | "done" | "error";
  progress: number;
  speed: number | null;
  eta: number | null;
  queuePosition?: number;
  error?: string;
  fileName?: string;
  size?: number;
}
export interface Health {
  ok: boolean;
  ytdlp: string | null;
  ffmpeg: boolean;
  limits?: { maxDurationMin: number; maxFileSizeMb: number };
}

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const STORAGE_KEY = "mddownload.apiBase";
const clean = (v: string) => v.trim().replace(/\/+$/, "");

let runtimeBase = "";

/**
 * Optional /config.json shipped next to index.html: { "apiBase": "https://your-api.example.com" }.
 * Lets you point an already-built site (e.g. a Netlify drag-and-drop deploy) at your backend by
 * editing one small file, with no rebuild.
 */
export async function loadRuntimeConfig(): Promise<void> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: "no-store", signal: ctrl.signal });
    if (!res.ok) return;
    const cfg = await res.json();
    if (cfg && typeof cfg.apiBase === "string") runtimeBase = clean(cfg.apiBase);
  } catch {
    /* the file is optional */
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Where the API lives. Priority:
 *   1. URL saved in this browser (the "Connect server" dialog)
 *   2. /config.json  →  apiBase
 *   3. VITE_API_BASE (set at build time)
 *   4. same origin (/api)
 */
export function getApiBase(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return clean(saved);
  } catch {
    /* storage unavailable */
  }
  return runtimeBase || clean((import.meta.env.VITE_API_BASE as string | undefined) ?? "");
}

export function setApiBase(value: string) {
  try {
    if (value.trim()) localStorage.setItem(STORAGE_KEY, clean(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function request<T>(path: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const { timeoutMs = 90_000, ...rest } = init ?? {};
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${getApiBase()}/api${path}`, {
      ...rest,
      signal: ctrl.signal,
      headers: rest.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch {
    throw new ApiError("Can't reach the download server. Check your connection or the server settings.", 0);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? "Something went wrong. Please try again.", res.status);
  }
  return data as T;
}

export const api = {
  health: () => request<Health>("/health", { timeoutMs: 10_000 }),
  info: (url: string) =>
    request<{ info: VideoInfo }>("/info", { method: "POST", body: JSON.stringify({ url }) }).then((r) => r.info),
  startJob: (url: string, kind: Kind, quality: number) =>
    request<{ id: string }>("/jobs", { method: "POST", body: JSON.stringify({ url, kind, quality }) }),
  job: (id: string) => request<JobState>(`/jobs/${id}`, { timeoutMs: 15_000 }),
  cancel: (id: string) => request<void>(`/jobs/${id}`, { method: "DELETE", timeoutMs: 15_000 }),
  fileUrl: (id: string) => `${getApiBase()}/api/jobs/${id}/file`,
};
