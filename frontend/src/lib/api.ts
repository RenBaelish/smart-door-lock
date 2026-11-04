export const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type LogStatus =
  | "success"
  | "out_of_schedule"
  | "unregistered"
  | "no_face"
  | "tailgating"
  | "failed";

export type RecognizeStatus =
  | "success"
  | "invalid"
  | "no_face"
  | "tailgating"
  | "out_of_schedule";

export interface AccessLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role?: string | null;
  user_nim?: string | null;
  user_kelas?: string | null;
  room?: string | null;
  status: LogStatus | string;
  reason?: string | null;
  timestamp: string;
  confidence_score: number | null;
  has_image?: boolean;
  image_url?: string | null;
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
  role?: string | null;
  nim?: string | null;
  kelas?: string | null;
  prodi?: string | null;
  jurusan?: string | null;
  has_face?: boolean;
  image_url?: string | null;
  created_at: string;
}

export interface RegisterResponse extends User {
  faces_detected: number;
}

export interface Stats {
  total_users: number;
  total_with_face?: number;
  total_mahasiswa?: number;
  total_mahasiswa_with_face?: number;
  total_dosen?: number;
  total_dosen_with_face?: number;
  total_admin?: number;
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
  decision?: "ACCEPT" | "DENY";
  name: string | null;
  role?: string | null;
  nim?: string | null;
  kelas?: string | null;
  room?: string | null;
  subject?: string | null;
  lecturer?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  schedule_time?: string | null;
  day?: string | null;
  wib_time?: string | null;
  lcd_line1?: string | null;
  lcd_line2?: string | null;
  serial_log?: string | null;
  reason?: string | null;
  distance: number | null;
  faces_detected: number;
  box: FaceBox | null;
  all_boxes?: FaceBox[] | null;
  frame: { width: number; height: number };
  threshold: number;
  log_id: number | null;
  image_url?: string | null;
}

export interface DoorDeviceMap {
  doors: { ip_address: string; room: string; subnet: string }[];
  map: Record<string, string>;
}

export interface ClassSchedule {
  id: number;
  kelas: string;
  day: string;
  slot?: string | null;
  start_time: string;
  end_time: string;
  subject: string;
  lecturer: string;
  room: string;
  sks: number;
}

export interface ClassScheduleIn {
  kelas?: string;
  day: string;
  slot?: string | null;
  start_time: string;
  end_time: string;
  subject: string;
  lecturer: string;
  room: string;
  sks?: number;
}

export interface CurrentScheduleResponse {
  wib_time: string;
  wib_day: string;
  kelas: string;
  has_active_lecture: boolean;
  active_schedule: ClassSchedule | null;
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

export interface LecturerInfo {
  name: string;
  classes: string[];
  rooms: string[];
  subjects: string[];
  main_room: string;
  main_class: string;
}

export const api = {
  health: () => request<{ status: string; wib_time?: string; wib_day?: string }>("/api/health"),

  stats: () => request<Stats>("/api/stats"),

  rooms: () => request<string[]>("/api/rooms"),

  doors: () => request<DoorDeviceMap>("/api/doors"),

  updateDoor: (ip_address: string, room: "GSG210" | "GSG211") =>
    request<{ status: string; ip_address: string; room: string; map: Record<string, string> }>("/api/doors", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ip_address, room }),
    }),

  lecturers: () => request<LecturerInfo[]>("/api/lecturers"),

  logs: (params: { limit?: number; offset?: number; status?: string | null; room?: string | null; role?: string | null } = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));
    if (params.status) query.set("status", params.status);
    if (params.room) query.set("room", params.room);
    if (params.role) query.set("role", params.role);
    const qs = query.toString();
    return request<LogsResponse>(`/api/logs${qs ? `?${qs}` : ""}`);
  },

  clearLogs: () => request<void>("/api/logs", { method: "DELETE" }),

  users: (params: { role?: string | null; has_face?: boolean | null; search?: string | null } = {}) => {
    const query = new URLSearchParams();
    if (params.role) query.set("role", params.role);
    if (params.has_face !== undefined && params.has_face !== null) query.set("has_face", String(params.has_face));
    if (params.search) query.set("search", params.search);
    const qs = query.toString();
    return request<User[]>(`/api/users${qs ? `?${qs}` : ""}`);
  },

  createUser: (data: { name: string; role?: string; nim?: string; kelas?: string; prodi?: string; jurusan?: string }) =>
    request<User>("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  updateUser: (id: number, data: Partial<{ name: string; role?: string; nim?: string; kelas?: string; prodi?: string; jurusan?: string; reset_face?: boolean }>) =>
    request<User>(`/api/users/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }),

  resetUserFace: (id: number) =>
    request<User>(`/api/users/${id}/face`, {
      method: "DELETE",
    }),

  deleteUser: (id: number) => request<void>(`/api/users/${id}`, { method: "DELETE" }),

  deleteAllUsers: () => request<void>("/api/users", { method: "DELETE" }),

  register: (
    dataOrName: string | { name?: string; role?: string; nim?: string; kelas?: string; prodi?: string; jurusan?: string; userId?: number; image: Blob },
    maybeImage?: Blob,
  ) => {
    const form = new FormData();
    if (typeof dataOrName === "string") {
      form.append("name", dataOrName);
      if (maybeImage) form.append("file", maybeImage, "capture.jpg");
    } else {
      if (dataOrName.name) form.append("name", dataOrName.name);
      if (dataOrName.role) form.append("role", dataOrName.role);
      if (dataOrName.nim) form.append("nim", dataOrName.nim);
      if (dataOrName.kelas) form.append("kelas", dataOrName.kelas);
      if (dataOrName.prodi) form.append("prodi", dataOrName.prodi);
      if (dataOrName.jurusan) form.append("jurusan", dataOrName.jurusan);
      if (dataOrName.userId) form.append("user_id", String(dataOrName.userId));
      form.append("file", dataOrName.image, "capture.jpg");
    }
    return request<RegisterResponse>("/api/register", { method: "POST", body: form });
  },

  recognize: (
    image: Blob,
    optionsOrBypass:
      | boolean
      | { room?: string; bypassSchedule?: boolean; isSimulation?: boolean; signal?: AbortSignal }
      | AbortSignal = false,
    maybeSignal?: AbortSignal,
  ) => {
    let room: string | undefined;
    let bypassSchedule = false;
    let isSimulation = false;
    let signal: AbortSignal | undefined;

    if (typeof optionsOrBypass === "boolean") {
      bypassSchedule = optionsOrBypass;
      signal = maybeSignal;
    } else if (optionsOrBypass instanceof AbortSignal) {
      signal = optionsOrBypass;
    } else if (typeof optionsOrBypass === "object" && optionsOrBypass !== null) {
      room = optionsOrBypass.room;
      bypassSchedule = !!optionsOrBypass.bypassSchedule;
      isSimulation = !!optionsOrBypass.isSimulation;
      signal = optionsOrBypass.signal || maybeSignal;
    }

    const form = new FormData();
    form.append("file", image, "frame.jpg");
    const query = new URLSearchParams();
    if (room) query.set("room", room);
    if (bypassSchedule) query.set("bypass_schedule", "true");
    if (isSimulation) query.set("is_simulation", "true");
    const qs = query.toString();
    return request<RecognizeResponse>(`/api/recognize${qs ? `?${qs}` : ""}`, { method: "POST", body: form, signal });
  },

  schedules: (params: { kelas?: string; day?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.kelas) query.set("kelas", params.kelas);
    if (params.day) query.set("day", params.day);
    const qs = query.toString();
    return request<ClassSchedule[]>(`/api/schedules${qs ? `?${qs}` : ""}`);
  },

  currentSchedule: (kelas = "TMJ 5C") =>
    request<CurrentScheduleResponse>(`/api/schedules/current?kelas=${encodeURIComponent(kelas)}`),

  createSchedule: (schedule: ClassScheduleIn) =>
    request<ClassSchedule>("/api/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    }),

  updateSchedule: (id: number, schedule: ClassScheduleIn) =>
    request<ClassSchedule>(`/api/schedules/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schedule),
    }),

  deleteSchedule: (id: number) => request<void>(`/api/schedules/${id}`, { method: "DELETE" }),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof TypeError) return `Cannot reach the API at ${API_BASE}. Is the backend running?`;
  if (err instanceof Error) return err.message;
  return "Unexpected error.";
}

