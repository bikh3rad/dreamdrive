"use client";

import { useCallback, useEffect, useState } from "react";
import { api, money, ApiError, type User } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { PageHead, Table, Empty, Modal, Badge, roleLabel } from "@/components/admin/ui";

const ROLES = ["user", "judge", "support", "content_admin", "finance_admin", "superadmin"];
const ELEVATED = ["support", "content_admin", "finance_admin", "superadmin"];

export default function AdminUsersPage() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [sel, setSel] = useState<User | null>(null);
  const [credit, setCredit] = useState({ amount: "", reason: "" });
  const [err, setErr] = useState("");

  const load = useCallback(() => {
    api.admin.users(q, role).then((r) => setUsers(r.users || [])).catch(() => {});
  }, [q, role]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const patch = async (u: User, body: Partial<User>) => {
    try {
      await api.admin.updateUser(u.id, body);
      load();
      if (sel?.id === u.id) setSel({ ...sel, ...body } as User);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : "به‌روزرسانی ناموفق بود.");
    }
  };

  const grantCredit = async () => {
    if (!sel) return;
    const cents = Math.round(Number(credit.amount) * 100);
    if (!cents || !credit.reason.trim()) return setErr("مبلغ و دلیل الزامی است.");
    try {
      await api.admin.addCredit(sel.id, cents, credit.reason);
      setCredit({ amount: "", reason: "" });
      setErr("");
      load();
      setSel({ ...sel, credit_cents: sel.credit_cents + cents });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ثبت اعتبار ناموفق بود.");
    }
  };

  const canSetRole = me?.role === "superadmin";

  return (
    <>
      <PageHead
        title="کاربران و نقش‌ها"
        subtitle="جست‌وجو، مسدودسازی، تنظیم نقش و افزودن اعتبار. تغییر نقش‌های مدیریتی فقط توسط مدیر کل ممکن است و همهٔ اقدام‌ها در گزارش ممیزی ثبت می‌شود."
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <input
          className="field max-w-xs" placeholder="جست‌وجو با نام یا ایمیل…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <select className="field max-w-[12rem]" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">همهٔ نقش‌ها</option>
          {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>

      <Table head={["کاربر", "نقش", "احراز هویت", "اعتبار", "وضعیت", ""]}>
        {users.length === 0 && <Empty>کاربری یافت نشد.</Empty>}
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-canvas-alt/40">
            <td className="px-4 py-3">
              <p className="font-bold text-ink">{u.full_name}</p>
              <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{u.email}</p>
            </td>
            <td className="px-4 py-3">
              <Badge tone={ELEVATED.includes(u.role) ? "info" : "mute"}>{roleLabel(u.role)}</Badge>
            </td>
            <td className="px-4 py-3">
              <Badge tone={u.kyc_status === "verified" ? "ok" : u.kyc_status === "rejected" ? "bad" : "mute"}>
                {{ none: "انجام نشده", pending: "در انتظار", verified: "تأییدشده", rejected: "ردشده" }[u.kyc_status]}
              </Badge>
            </td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{money(u.credit_cents)}</td>
            <td className="px-4 py-3">
              {u.is_blocked && <Badge tone="bad">مسدود</Badge>}
              {u.is_insider && <Badge tone="warn">داخلی</Badge>}
              {!u.is_blocked && !u.is_insider && <span className="text-xs text-ink-muted">عادی</span>}
            </td>
            <td className="px-4 py-3 text-end">
              <button onClick={() => { setSel(u); setErr(""); }} className="text-xs font-bold text-brand-600 hover:underline">
                مدیریت
              </button>
            </td>
          </tr>
        ))}
      </Table>

      {sel && (
        <Modal title={sel.full_name} onClose={() => setSel(null)}>
          <p className="ltr-nums text-xs text-ink-muted">{sel.email}</p>

          <div className="mt-5 space-y-4">
            <div>
              <label className="label">نقش</label>
              <select
                className="field" value={sel.role} disabled={!canSetRole}
                onChange={(e) => patch(sel, { role: e.target.value as User["role"] })}
              >
                {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
              </select>
              {!canSetRole && (
                <p className="mt-1.5 text-xs text-ink-muted">فقط مدیر کل می‌تواند نقش را تغییر دهد.</p>
              )}
            </div>

            <div>
              <label className="label">وضعیت احراز هویت</label>
              <select
                className="field" value={sel.kyc_status}
                onChange={(e) => patch(sel, { kyc_status: e.target.value as User["kyc_status"] })}
              >
                <option value="none">انجام نشده</option>
                <option value="pending">در انتظار</option>
                <option value="verified">تأییدشده</option>
                <option value="rejected">ردشده</option>
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox" className="h-4 w-4 accent-[#F0A828]"
                checked={sel.is_blocked}
                onChange={(e) => patch(sel, { is_blocked: e.target.checked })}
              />
              حساب مسدود باشد
            </label>

            <label className="flex items-start gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox" className="mt-1 h-4 w-4 accent-[#F0A828]"
                checked={sel.is_insider}
                onChange={(e) => patch(sel, { is_insider: e.target.checked })}
              />
              <span>
                فرد داخلی (کارمند، پیمانکار یا بستگان درجه‌یک)
                <span className="mt-0.5 block text-xs text-ink-muted">
                  حساب‌های داخلی نمی‌توانند در هیچ مسابقه‌ای پیشنهاد ثبت کنند.
                </span>
              </span>
            </label>

            <div className="rounded-xl border border-ink/10 p-4">
              <p className="text-sm font-black text-ink">افزودن اعتبار</p>
              <p className="ltr-nums mt-1 text-xs text-ink-muted">
                اعتبار فعلی: {money(sel.credit_cents)}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-[7rem_1fr]">
                <input
                  className="field text-start" dir="ltr" type="number" placeholder="مبلغ"
                  value={credit.amount} onChange={(e) => setCredit({ ...credit, amount: e.target.value })}
                />
                <input
                  className="field" placeholder="دلیل (در ممیزی ثبت می‌شود)"
                  value={credit.reason} onChange={(e) => setCredit({ ...credit, reason: e.target.value })}
                />
              </div>
              <button onClick={grantCredit} className="btn-dark mt-3 !py-2 !px-4 text-xs">ثبت اعتبار</button>
            </div>

            {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
