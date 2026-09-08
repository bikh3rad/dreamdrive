"use client";

import { useEffect, useMemo, useState } from "react";
import { api, faNum } from "@/lib/api";
import { PageHead, Table, Empty, Badge } from "@/components/admin/ui";

interface AuditRow {
  id?: number;
  actor_id?: string | null;
  actor_email?: string;
  action: string;
  /** توصیف هدف — ایمیل کاربر، slug مسابقه یا شناسهٔ سفارش */
  target?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  created_at: string;
}

const SENSITIVE = ["settle", "refund", "role", "credit", "status", "delete", "block"];

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [q, setQ] = useState("");
  const [onlySensitive, setOnlySensitive] = useState(false);

  useEffect(() => {
    api.admin.audit(300).then((r) => setRows(r.entries || [])).catch(() => {});
  }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (onlySensitive && !SENSITIVE.some((s) => r.action?.toLowerCase().includes(s))) return false;
      if (!t) return true;
      return [r.actor_email, r.action, r.target]
        .some((v) => v?.toLowerCase().includes(t));
    });
  }, [rows, q, onlySensitive]);

  const csv = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      "time,actor,action,target,ip,meta",
      ...shown.map((r) =>
        [r.created_at, r.actor_email, r.action, r.target, r.ip,
         r.meta ? JSON.stringify(r.meta) : ""].map(esc).join(","),
      ),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "audit-log.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead
        title="گزارش ممیزی"
        subtitle="هر اقدام مدیریتی — تغییر نقش، بازگشت وجه، تغییر وضعیت مسابقه، تسویه — با هویت انجام‌دهنده ثبت می‌شود. این گزارش فقط افزودنی است و پاک نمی‌شود."
        action={
          <button onClick={csv} className="btn-ghost !py-2.5 text-sm">خروجی CSV</button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="field max-w-xs" placeholder="جست‌وجو در اقدام‌ها…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          <input
            type="checkbox" className="h-4 w-4 accent-[#F0A828]"
            checked={onlySensitive} onChange={(e) => setOnlySensitive(e.target.checked)}
          />
          فقط اقدام‌های حساس
        </label>
        <span className="ms-auto text-sm text-ink-muted">
          <span className="ltr-nums font-bold text-ink">{faNum(shown.length)}</span> ردیف
        </span>
      </div>

      <Table head={["زمان", "انجام‌دهنده", "اقدام", "هدف", "IP"]}>
        {shown.length === 0 && <Empty>موردی ثبت نشده است.</Empty>}
        {shown.map((r, i) => {
          const hot = SENSITIVE.some((s) => r.action?.toLowerCase().includes(s));
          return (
            <tr key={r.id || i} className="hover:bg-canvas-alt/40">
              <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-muted">
                {new Date(r.created_at).toLocaleString("fa-IR")}
              </td>
              <td className="px-4 py-3">
                <p className="ltr-nums text-xs text-ink">{r.actor_email || "سیستم"}</p>
              </td>
              <td className="px-4 py-3">
                <Badge tone={hot ? "warn" : "mute"}>{r.action}</Badge>
              </td>
              <td className="ltr-nums px-4 py-3 text-xs text-ink-soft">
                <p>{r.target || "—"}</p>
                {r.meta && Object.keys(r.meta).length > 0 && (
                  <p className="mt-0.5 max-w-[18rem] truncate text-[11px] text-ink-muted">
                    {JSON.stringify(r.meta)}
                  </p>
                )}
              </td>
              <td className="ltr-nums px-4 py-3 text-xs text-ink-muted">{r.ip || "—"}</td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
