export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type LogStatus = "success" | "failed";
export type RecognizeStatus = "success" | "invalid" | "no_face" | "tailgating";

export interface AccessLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  status: LogStatus;
  reason?: string | null;
  timestamp: string;
  confidence_score: number | null;
}

export interface LogsResponse {
  total: number;
  limit: number;
  offset: number;
  items: AccessLog[];
}

export interface User {
  id: number;
  name: string;
  created_at: string;
}

export interface RegisterResponse extends User {
  faces_detected: number;
}

export interface Stats {
  total_users: number;
  total_attempts: number;
  success_24h: number;
  failed_24h: number;
  match_threshold: number;
  detection_model: string;
  recent_logs: AccessLog[];
}

export interface FaceBox {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface RecognizeResponse {
  status: RecognizeStatus;
  name: string | null;
  reason?: string | null;
  distance: number | null;
  faces_detected: number;
  box: FaceBox | null;
  frame: { width: number; height: number };
  threshold: number;
  log_id: number | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store", ...init });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") message = body.detail;
      else if (Array.isArray(body?.detail) && body.detail[0]?.msg) message = body.detail[0].msg;
    } catch {
      // Non-JSON error body; keep the generic message.
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ status: string }>("/api/health"),

  stats: () => request<Stats>("/api/stats"),

  logs: (params: { limit?: number; offset?: number; status?: LogStatus | null } = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    if (params.status) query.set("status", params.status);
    const qs = query.toString();
    return request<LogsResponse>(`/api/logs${qs ? `?${qs}` : ""}`);
  },

  users: () => request<User[]>("/api/users"),

  deleteUser: (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" }),

  register: (name: string, image: Blob) => {
    const form = new FormData();
    form.append("name", name);
    form.append("file", image, "capture.jpg");
    return request<RegisterResponse>("/api/register", { method: "POST", body: form });
  },

  recognize: (image: Blob, signal?: AbortSignal) => {
    const form = new FormData();
    form.append("file", image, "frame.jpg");
    return request<RecognizeResponse>("/api/recognize", { method: "POST", body: form, signal });
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return `Cannot reach the API at ${API_BASE}. Is the backend running?`;
  if (err instanceof Error) return err.message;
  return "Unexpected error.";
}
