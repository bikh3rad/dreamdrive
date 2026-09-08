"use client";

import { useCallback, useEffect, useState } from "react";
import { api, faNum, money, ApiError, type Order } from "@/lib/api";
import { PageHead, Table, Empty, Badge, statusLabel, statusTone } from "@/components/admin/ui";

// همان وضعیت‌هایی که سرور واقعاً می‌نویسد
const TABS = ["", "paid", "pending", "refunded"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    api.admin.orders(status, q).then((r) => setOrders(r.orders || [])).catch(() => {});
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const refund = async (o: Order) => {
    if (!confirm(`بازگرداندن ${money(o.total_cents, o.currency)} به کیف پول کاربر؟ پیشنهادهای ثبت‌شده باطل نمی‌شوند.`)) return;
    try { await api.admin.refund(o.id); load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "بازگشت وجه ناموفق بود."); }
  };

  const sum = orders.filter((o) => o.status === "paid").reduce((s, o) => s + o.total_cents, 0);

  return (
    <>
      <PageHead
        title="سفارش‌ها"
        subtitle="همهٔ پرداخت‌ها و ورودهای رایگان. بازگشت وجه به‌صورت اعتبار کیف پول انجام می‌شود و در گزارش ممیزی ثبت می‌گردد."
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-full border border-ink/10 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t || "all"}
              onClick={() => setStatus(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                status === t ? "bg-brand-500 text-ink" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t ? statusLabel(t) : "همه"}
            </button>
          ))}
        </div>
        <input
          className="field max-w-xs" placeholder="جست‌وجو با ایمیل یا شناسهٔ سفارش…"
          value={q} onChange={(e) => setQ(e.target.value)}
        />
        <span className="ms-auto text-sm text-ink-muted">
          جمع پرداخت‌شده‌ها:{" "}
          <span className="ltr-nums font-black text-ink">{money(sum)}</span>
          {" · "}
          <span className="ltr-nums">{faNum(orders.length)}</span> ردیف
        </span>
      </div>

      <Table head={["شناسه", "کاربر", "اقلام", "مبلغ", "وضعیت", "تاریخ", ""]}>
        {orders.length === 0 && <Empty>سفارشی یافت نشد.</Empty>}
        {orders.map((o) => (
          <tr key={o.id} className="hover:bg-canvas-alt/40">
            <td className="ltr-nums px-4 py-3 text-xs text-ink-muted">{o.id.slice(0, 8)}</td>
            <td className="ltr-nums px-4 py-3 text-ink">{o.user_email || "—"}</td>
            <td className="px-4 py-3 text-xs text-ink-soft">
              {o.items?.length
                ? o.items.map((i, k) => (
                    <span key={k} className="block">
                      {i.title || i.competition_slug} × <span className="ltr-nums">{faNum(i.qty)}</span>
                    </span>
                  ))
                : "—"}
            </td>
            <td className="ltr-nums px-4 py-3 font-bold text-ink">{money(o.total_cents, o.currency)}</td>
            <td className="px-4 py-3"><Badge tone={statusTone(o.status)}>{statusLabel(o.status)}</Badge></td>
            <td className="px-4 py-3 text-xs text-ink-soft">
              {new Date(o.created_at).toLocaleDateString("fa-IR")}
            </td>
            <td className="px-4 py-3 text-end">
              {o.status === "paid" && (
                <button onClick={() => refund(o)} className="text-xs font-bold text-red-600 hover:underline">
                  بازگشت وجه
                </button>
              )}
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
