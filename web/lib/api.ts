// کلاینت API — توکن در حافظهٔ ماژول و کوکی نگه‌داری می‌شود.

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export type Role =
  | "user" | "support" | "content_admin" | "finance_admin" | "superadmin"
  | "judge" | "auditor";

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

/**
 * یک سطح قابل خرید: جایزه به‌علاوهٔ قیمت بلیط آن.
 *
 * انتخاب سطح شانس برنده‌شدن را تغییر نمی‌دهد — همه در یک استخر واحد رقابت
 * می‌کنند. فقط تعیین می‌کند اگر این بلیط برندهٔ آن دوره شد چه چیزی تحویل
 * داده می‌شود.
 */
export interface CompetitionPrize {
  id: string;
  competition_id: string;
  prize_id: string;
  ticket_price_cents: number;
  sort: number;
  is_active: boolean;
  prize?: Prize;
}

export interface Competition {
  id: string;
  slug: string;
  /** بازنشسته — قیمت و جایزه در prizes است. فقط برای دادهٔ قدیمی. */
  prize_id?: string;
  title: string;
  /** بازنشسته — به prizes[].ticket_price_cents نگاه کن. */
  ticket_price_cents?: number;
  currency: string;
  board_image: string;
  opens_at: string;
  closes_at: string;
  status: "draft" | "open" | "closed" | "judging" | "settled" | "cancelled";
  max_entries_user: number;
  /** سقف کل حدس‌های دوره؛ با رسیدن به آن مسابقه بسته و آمادهٔ داوری می‌شود. ۰ = بدون سقف. */
  entry_target: number;
  prizes?: CompetitionPrize[];
  /** جایزهٔ شاخص برای تصویر و تیتر کارت؛ گران‌ترین سطح فعال. */
  prize?: Prize;
  /** حدس‌های قطعی (رایگان یا پرداخت‌شده) — همان عددی که دوره را می‌بندد. */
  entry_count?: number;
  /**
   * صندلی‌های اشغال‌شده، شامل سفارش pending. گیتِ فروش سرور با همین می‌سنجد،
   * پس برای «آیا خرید تازه پذیرفته می‌شود؟» باید این خوانده شود نه
   * entry_count. فقط در پاسخ یک مسابقهٔ تکی می‌آید.
   */
  reserved_count?: number;
  /** جمع فروش پرداخت‌شدهٔ همین مسابقه. فقط در پاسخ‌های مدیریتی می‌آید. */
  revenue_cents?: number;
  created_at?: string;
}

export interface Entry {
  id: string;
  user_id?: string;
  competition_id: string;
  competition_slug?: string;
  competition_prize_id?: string;
  prize_title?: string;
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
  items?: {
    competition_slug?: string;
    title?: string;
    competition_prize_id?: string;
    prize_title?: string;
    qty: number;
    unit_price_cents: number;
  }[];
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
  /**
   * جایزه‌ای که واقعاً اهدا شد — همانی که برنده هنگام شرکت انتخاب کرده بود.
   * خالی یعنی این دوره برنده نداشت. بقیهٔ جوایز همان دوره اهدا نمی‌شوند و
   * این حالت طبیعی است، نه خطا.
   */
  awarded_prize_id?: string;
  awarded_title?: string;
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

export interface Incident {
  id: number;
  competition_id: string;
  competition_slug?: string;
  competition_title?: string;
  kind: "chain_broken" | "settle_blocked" | "commit_conflict" | "manual";
  detail: string;
  first_bad_seq: number;
  checked_count: number;
  detected_at: string;
  status: "open" | "acknowledged" | "resolved";
  ack_by?: string;
  ack_by_email?: string;
  ack_at?: string;
  resolution: string;
  resolved_by?: string;
  resolved_at?: string;
}

export interface AuditEntry {
  id: number;
  actor_id?: string;
  actor_email?: string;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  ip: string;
  created_at: string;
}

export interface ChainCheck {
  checked: number;
  intact: boolean;
  first_bad_seq: number;
  incident_id?: number;
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

/**
 * آپلود فایل مسیر جدایی دارد چون request() سرآیند JSON را ثابت می‌گذارد.
 * برای multipart باید Content-Type را اصلاً ننویسیم تا مرورگر خودش
 * boundary را اضافه کند؛ در غیر این صورت سرور فرم را نمی‌تواند بخواند.
 */
async function upload(
  path: string,
  file: File,
  fields: Record<string, string> = {},
): Promise<UploadResult> {
  const fd = new FormData();
  fd.append("file", file);
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);

  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: fd });
  const text = await res.text();
  // پاسخ خطای پروکسی یا سقف حجم ممکن است JSON نباشد
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text.slice(0, 200) };
  }
  if (!res.ok) {
    throw new ApiError(res.status, body.error || `upload failed (${res.status})`);
  }
  return body as UploadResult;
}

export interface UploadResult {
  url: string;
  key: string;
  bytes: number;
  type: string;
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
  // هر قلم به یک سطح جایزه گره می‌خورد. قیمت عمداً فرستاده نمی‌شود — سرور
  // آن را از روی competition_prize_id می‌خواند.
  checkout: (
    lines: {
      competition_slug: string;
      competition_prize_id: string;
      picks: { x: number; y: number }[];
    }[],
    useCredit = false,
  ) =>
    request<{ order: Order; entries: Entry[] }>("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ lines, use_credit: useCredit }),
    }),
  freeEntry: (competition_slug: string, competition_prize_id: string, x: number, y: number) =>
    request<Entry>("/api/free-entry", {
      method: "POST",
      body: JSON.stringify({ competition_slug, competition_prize_id, x, y }),
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

  // ناظر مستقل — همه فقط-خواندنی جز رسیدگی به حادثه
  auditor: {
    incidents: (onlyOpen = false) =>
      request<{ incidents: Incident[] }>(
        `/api/auditor/incidents${onlyOpen ? "?open=1" : ""}`,
      ),
    ack: (id: number) =>
      request<{ status: string }>(`/api/auditor/incidents/${id}/ack`, {
        method: "POST",
      }),
    resolve: (id: number, resolution: string) =>
      request<{ status: string }>(`/api/auditor/incidents/${id}/resolve`, {
        method: "POST",
        body: JSON.stringify({ resolution }),
      }),
    competitions: () =>
      request<{ competitions: Competition[] }>("/api/auditor/competitions"),
    // POST چون در صورت شکست زنجیره حادثه ثبت می‌شود
    verify: (id: string) =>
      request<ChainCheck>(`/api/auditor/competitions/${id}/verify`, { method: "POST" }),
    raise: (id: string, detail: string) =>
      request<{ incident_id: number; status: string }>(
        `/api/auditor/competitions/${id}/incidents`,
        { method: "POST", body: JSON.stringify({ detail }) },
      ),
    panel: (id: string) =>
      request<{ panel: JudgeStatus[] }>(`/api/auditor/competitions/${id}/panel`),
    audit: (limit = 100) =>
      request<{ entries: AuditEntry[] }>(`/api/auditor/audit?limit=${limit}`),
  },

  // ادمین
  admin: {
    stats: () => request<Stats>("/api/admin/stats"),
    upload: (file: File, folder = "prizes") =>
      upload("/api/admin/uploads", file, { folder }),
    audit: (limit = 100) => request<{ entries: any[] }>(`/api/admin/audit?limit=${limit}`),

    prizes: () => request<{ prizes: Prize[] }>("/api/admin/prizes"),
    createPrize: (b: Partial<Prize>) =>
      request<Prize>("/api/admin/prizes", { method: "POST", body: JSON.stringify(b) }),
    updatePrize: (id: string, b: Partial<Prize>) =>
      request<Prize>(`/api/admin/prizes/${id}`, { method: "PUT", body: JSON.stringify(b) }),
    deletePrize: (id: string) =>
      request<void>(`/api/admin/prizes/${id}`, { method: "DELETE" }),

    competitions: () => request<{ competitions: Competition[] }>("/api/admin/competitions"),
    // دوره‌هایی که شرط بسته‌شدنشان رسیده ولی منتظر تعهد داوران مانده‌اند.
    stuckCompetitions: () =>
      request<{ competitions: Competition[] }>("/api/admin/competitions/stuck"),
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
      request<ChainCheck>(`/api/admin/competitions/${id}/verify`, { method: "POST" }),
    settle: (id: string) => request<any>(`/api/admin/competitions/${id}/settle`, { method: "POST" }),
  },
};

// ---------- کمک‌توابع نمایش ----------

/**
 * مبلغ را از «کمترین واحد پول» به متن نمایشی تبدیل می‌کند.
 *
 * ریال زیرواحد ندارد: عدد ذخیره‌شده خودِ ریال است و نباید بر ۱۰۰ تقسیم شود.
 * تقسیم‌کردن یعنی نمایش یک‌صدم قیمت واقعی — خطایی که در ظاهر بی‌ضرر است و
 * مستقیم به شکایت مالی می‌رسد. برای ارزهای زیرواحددار (یورو، دلار) رفتار
 * قبلی حفظ شده تا دادهٔ تاریخی درست دیده شود.
 */
const NO_SUBUNIT = new Set(["IRR", "IRT", "JPY", "KRW", "VND"]);

export function money(cents: number, currency = "IRR"): string {
  if (NO_SUBUNIT.has(currency)) {
    const label = currency === "IRR" ? "ریال" : currency;
    return `${faNum(Math.round(cents).toLocaleString("en-US"))} ${label}`;
  }
  const symbol = currency === "CAD" ? "CA$" : currency === "EUR" ? "€" : "$";
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

/** سطوح قابل خرید یک مسابقه، مرتب بر اساس قیمت. */
export function activeLevels(c: Competition): CompetitionPrize[] {
  return (c.prizes || [])
    .filter((l) => l.is_active)
    .sort((a, b) => a.ticket_price_cents - b.ticket_price_cents);
}

/**
 * قیمت شروع: ارزان‌ترین سطح فعال.
 *
 * برای کارت و فهرست، «از … » درست‌تر از یک قیمت واحد است؛ نمایش گران‌ترین
 * قیمت به‌عنوان قیمت مسابقه، کاربر را بی‌دلیل پس می‌زند.
 */
export function startingPrice(c: Competition): number | null {
  const lv = activeLevels(c);
  return lv.length ? lv[0].ticket_price_cents : null;
}

/** همان مبلغ به تومان — برای جایی که می‌خواهیم واحد آشناتر نشان دهیم. */
export function toman(rials: number): string {
  return `${faNum(Math.round(rials / 10).toLocaleString("en-US"))} تومان`;
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
