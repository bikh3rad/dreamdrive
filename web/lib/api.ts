// کلاینت API — توکن در حافظهٔ ماژول و کوکی نگه‌داری می‌شود.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type Role =
  | "user" | "support" | "content_admin" | "finance_admin" | "superadmin" | "judge";

export interface User {
  id: string;
  email: string;
  full_name: string;
  country: string;
  role: Role;
  kyc_status: "none" | "pending" | "verified" | "rejected";
  credit_cents: number;
  is_blocked: boolean;
  is_insider: boolean;
  created_at: string;
}

export interface Prize {
  id: string;
  slug: string;
  title: string;
  kind: string;
  subtitle: string;
  body_md: string;
  spec: Record<string, unknown>;
  value_cents: number;
  hero_image: string;
  media?: { id: string; url: string; caption: string; sort: number }[];
  created_at?: string;
}

export interface Competition {
  id: string;
  slug: string;
  prize_id: string;
  title: string;
  ticket_price_cents: number;
  currency: string;
  board_image: string;
  opens_at: string;
  closes_at: string;
  status: "draft" | "open" | "closed" | "judging" | "settled" | "cancelled";
  max_entries_user: number;
  prize?: Prize;
  entry_count?: number;
  created_at?: string;
}

export interface Entry {
  id: string;
  user_id?: string;
  competition_id: string;
  competition_slug?: string;
  x: number;
  y: number;
  is_free_entry: boolean;
  seq: number;
  hash: string;
  created_at: string;
}

export interface Order {
  id: string;
  user_id: string;
  user_email?: string;
  total_cents: number;
  currency: string;
  status: "pending" | "paid" | "refunded";
  provider: string;
  provider_ref?: string;
  created_at: string;
  paid_at: string | null;
  items?: { competition_slug?: string; title?: string; qty: number; unit_price_cents: number }[];
}

export interface Winner {
  competition_slug: string;
  competition_title: string;
  prize_title: string;
  hero_image: string;
  winner_name: string;
  country: string;
  video_url: string;
  decided_at: string;
}

export interface Stats {
  users: number;
  open_competitions: number;
  entries_total: number;
  revenue_cents: number;
  revenue_30d_cents: number;
  orders_30d: number;
  daily: { day: string; cents: number; orders: number }[];
}

export interface CompetitionResult {
  competition_id: string;
  final_x: number;
  final_y: number;
  winner_entry_id: string | null;
  winner_user_id: string | null;
  /** فقط در پاسخ‌های مدیریتی پر می‌شود؛ در API عمومی خالی است */
  winner_email?: string;
  winner_name?: string;
  distance: number;
  video_url: string;
  decided_at: string;
}

export interface JudgeStatus {
  judge_id: string;
  display_name: string;
  committed: boolean;
  revealed: boolean;
  x?: number;
  y?: number;
}

const TOKEN_KEY = "dd_token";

export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)dd_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function setToken(token: string) {
  if (typeof document === "undefined") return;
  // 7 روز، مطابق TTL توکن سمت سرور
  document.cookie = `${TOKEN_KEY}=${encodeURIComponent(token)}; path=/; max-age=${7 * 24 * 3600}; samesite=lax`;
}

export function clearToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((init.headers as Record<string, string>) || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(res.status, body.error || `request failed (${res.status})`);
  }
  return body as T;
}

export const api = {
  // احراز هویت
  register: (b: { email: string; password: string; full_name: string; country: string }) =>
    request<{ token: string; user: User }>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  login: (b: { email: string; password: string }) =>
    request<{ token: string; user: User }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(b),
    }),
  me: () => request<User>("/api/me"),
  updateMe: (b: { full_name: string; country: string }) =>
    request<User>("/api/me", { method: "PATCH", body: JSON.stringify(b) }),

  // عمومی
  competitions: (all = false) =>
    request<{ competitions: Competition[] }>(`/api/competitions${all ? "?include=all" : ""}`),
  competition: (slug: string) => request<Competition>(`/api/competitions/${slug}`),
  result: (slug: string) =>
    request<{ result: CompetitionResult; panel: JudgeStatus[] }>(`/api/competitions/${slug}/result`),
  winners: () => request<{ winners: Winner[] }>("/api/winners"),
  page: (slug: string) =>
    request<{ slug: string; title: string; body_md: string }>(`/api/pages/${slug}`),
  settings: () => request<Record<string, any>>("/api/settings"),

  // کاربر
  checkout: (lines: { competition_slug: string; picks: { x: number; y: number }[] }[], useCredit = false) =>
    request<{ order: Order; entries: Entry[] }>("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ lines, use_credit: useCredit }),
    }),
  freeEntry: (competition_slug: string, x: number, y: number) =>
    request<Entry>("/api/free-entry", {
      method: "POST",
      body: JSON.stringify({ competition_slug, x, y }),
    }),
  myEntries: () => request<{ entries: Entry[] }>("/api/me/entries"),
  myOrders: () => request<{ orders: Order[] }>("/api/me/orders"),

  // داور
  judge: {
    competitions: () =>
      request<{ competitions: Competition[] }>("/api/judge/competitions"),
    commit: (id: string, commit_hash: string) =>
      request<{ status: string }>(`/api/judge/${id}/commit`, {
        method: "POST",
        body: JSON.stringify({ commit_hash }),
      }),
    reveal: (id: string, x: number, y: number, nonce: string) =>
      request<{ status: string }>(`/api/judge/${id}/reveal`, {
        method: "POST",
        body: JSON.stringify({ x, y, nonce }),
      }),
  },

  // ادمین
  admin: {
    stats: () => request<Stats>("/api/admin/stats"),
    audit: (limit = 100) => request<{ entries: any[] }>(`/api/admin/audit?limit=${limit}`),

    prizes: () => request<{ prizes: Prize[] }>("/api/admin/prizes"),
    createPrize: (b: Partial<Prize>) =>
      request<Prize>("/api/admin/prizes", { method: "POST", body: JSON.stringify(b) }),
    updatePrize: (id: string, b: Partial<Prize>) =>
      request<Prize>(`/api/admin/prizes/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    deletePrize: (id: string) =>
      request<void>(`/api/admin/prizes/${id}`, { method: "DELETE" }),

    competitions: () => request<{ competitions: Competition[] }>("/api/admin/competitions"),
    createCompetition: (b: any) =>
      request<Competition>("/api/admin/competitions", { method: "POST", body: JSON.stringify(b) }),
    updateCompetition: (id: string, b: any) =>
      request<Competition>(`/api/admin/competitions/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    setStatus: (id: string, status: string) =>
      request<{ status: string }>(`/api/admin/competitions/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),

    users: (q = "", role = "") =>
      request<{ users: User[]; total: number }>(
        `/api/admin/users?q=${encodeURIComponent(q)}&role=${role}`,
      ),
    updateUser: (id: string, b: Partial<User>) =>
      request<User>(`/api/admin/users/${id}`, { method: "PATCH", body: JSON.stringify(b) }),
    addCredit: (id: string, cents: number, reason: string) =>
      request<{ status: string }>(`/api/admin/users/${id}/credit`, {
        method: "POST",
        body: JSON.stringify({ cents, reason }),
      }),

    orders: (status = "", q = "") =>
      request<{ orders: Order[]; total: number }>(
        `/api/admin/orders?status=${status}&q=${encodeURIComponent(q)}`,
      ),
    refund: (id: string) =>
      request<{ status: string }>(`/api/admin/orders/${id}/refund`, { method: "POST" }),

    pages: () => request<{ pages: any[] }>("/api/admin/pages"),
    savePage: (b: { slug: string; title: string; body_md: string; published: boolean }) =>
      request<any>("/api/admin/pages", { method: "PUT", body: JSON.stringify(b) }),

    saveSettings: (b: Record<string, any>) =>
      request<Record<string, any>>("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(b),
      }),

    panel: (id: string) => request<{ panel: JudgeStatus[] }>(`/api/admin/competitions/${id}/panel`),
    entries: (id: string) => request<{ entries: Entry[] }>(`/api/admin/competitions/${id}/entries`),
    verify: (id: string) =>
      request<{ checked: number; intact: boolean; first_bad_seq: number }>(
        `/api/admin/competitions/${id}/verify`,
      ),
    settle: (id: string) => request<any>(`/api/admin/competitions/${id}/settle`, { method: "POST" }),
  },
};

// ---------- کمک‌توابع نمایش ----------

export function money(cents: number, currency = "CAD"): string {
  const symbol = currency === "CAD" ? "CA$" : currency === "EUR" ? "€" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

export function faNum(n: number | string): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export function timeLeft(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "بسته شد";
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${faNum(d)} روز و ${faNum(h)} ساعت`;
  if (h > 0) return `${faNum(h)} ساعت و ${faNum(m)} دقیقه`;
  return `${faNum(m)} دقیقه`;
}
