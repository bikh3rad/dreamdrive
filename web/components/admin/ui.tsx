"use client";

import { faNum } from "@/lib/api";

export function roleLabel(r: string): string {
  return {
    user: "کاربر",
    support: "پشتیبانی",
    content_admin: "مدیر محتوا",
    finance_admin: "مدیر مالی",
    superadmin: "مدیر کل",
    judge: "داور",
    auditor: "ناظر مستقل",
  }[r] || r;
}

export function statusLabel(s: string): string {
  return {
    draft: "پیش‌نویس",
    open: "باز",
    closed: "بسته",
    judging: "در حال داوری",
    settled: "تسویه‌شده",
    cancelled: "لغو‌شده",
    pending: "در انتظار",
    paid: "پرداخت‌شده",
    failed: "ناموفق",
    refunded: "بازگشتی",
    free: "رایگان",
  }[s] || s;
}

const TONES: Record<string, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  warn: "bg-amber-50 text-amber-700",
  bad: "bg-red-50 text-red-700",
  info: "bg-brand-50 text-brand-700",
  mute: "bg-canvas-alt text-ink-soft",
};

export function Badge({ children, tone = "mute" }: { children: React.ReactNode; tone?: keyof typeof TONES }) {
  return <span className={`chip ${TONES[tone]}`}>{children}</span>;
}

export function statusTone(s: string): keyof typeof TONES {
  if (["open", "paid", "settled"].includes(s)) return "ok";
  if (["judging", "pending", "closed"].includes(s)) return "warn";
  if (["failed", "cancelled"].includes(s)) return "bad";
  if (["free", "refunded"].includes(s)) return "info";
  return "mute";
}

export function PageHead({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-black text-ink">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  icon: Icon, label, value, hint, tone = "brand",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "brand" | "ink";
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-ink-muted">{label}</span>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-canvas-alt text-ink-soft"
        }`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="ltr-nums mt-3 text-2xl font-black text-ink">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-ink-muted">{hint}</p>}
    </div>
  );
}

export function Table({
  head, children,
}: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/[.07] bg-canvas-alt/60 text-start">
              {head.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-start text-xs font-bold text-ink-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/[.05]">{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={99} className="px-4 py-14 text-center text-sm text-ink-muted">
        {children}
      </td>
    </tr>
  );
}

export function Modal({
  title, onClose, children, wide,
}: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm">
      <div className={`card my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} p-6`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-black text-ink">{title}</h2>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-sm text-ink-muted hover:bg-canvas-alt">
            بستن
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * سرور روز را به‌صورت RFC3339 برمی‌گرداند («2026-09-08T00:00:00Z»)، پس
 * فقط ماه و روز را جدا می‌کنیم نه یک برش کور از رشته.
 */
function dayLabel(day: string) {
  const d = new Date(day);
  if (Number.isNaN(d.getTime())) return day;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** نمودار میله‌ای ساده بدون کتابخانه */
export function BarChart({ data }: { data: { day: string; cents: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  return (
    <div className="flex h-40 items-end gap-1.5" dir="ltr">
      {data.map((d) => (
        <div key={d.day} className="group relative flex-1">
          <div
            className="w-full rounded-t bg-brand-400 transition group-hover:bg-brand-500"
            style={{ height: `${Math.max(3, (d.cents / max) * 150)}px` }}
          />
          <span className="ltr-nums pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-ink px-1.5 py-0.5 text-[10px] text-white group-hover:block">
            {dayLabel(d.day)} · {(d.cents / 100).toFixed(0)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function fa(n: number | string) {
  return faNum(n);
}
