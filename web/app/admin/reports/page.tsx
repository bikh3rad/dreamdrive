"use client";

import { useEffect, useState } from "react";
import { api, faNum, money, type Order, type Stats } from "@/lib/api";
import { PageHead, StatCard, BarChart, Table, Empty } from "@/components/admin/ui";
import { IconWallet, IconTicket, IconChart, IconUsers } from "@/components/icons";

export default function ReportsPage() {
  const [s, setS] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.admin.stats().then(setS).catch(() => {});
    api.admin.orders("paid").then((r) => setOrders(r.orders || [])).catch(() => {});
  }, []);

  const paid = orders.length;
  const avg = paid ? Math.round(orders.reduce((a, o) => a + o.total_cents, 0) / paid) : 0;

  // درآمد به تفکیک مسابقه
  const byComp = new Map<string, { cents: number; qty: number }>();
  for (const o of orders) {
    for (const it of o.items || []) {
      const key = it.title || it.competition_slug || "—";
      const cur = byComp.get(key) || { cents: 0, qty: 0 };
      cur.cents += it.qty * it.unit_price_cents;
      cur.qty += it.qty;
      byComp.set(key, cur);
    }
  }
  const rows = [...byComp.entries()].sort((a, b) => b[1].cents - a[1].cents);

  const csv = () => {
    const lines = [
      "competition,entries,revenue_cents",
      ...rows.map(([k, v]) => `"${k.replace(/"/g, '""')}",${v.qty},${v.cents}`),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "revenue-by-competition.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHead
        title="گزارش درآمد"
        subtitle="نمای مالی: درآمد روزانه، میانگین ارزش سفارش و سهم هر مسابقه."
        action={
          <button onClick={csv} className="btn-ghost !py-2.5 text-sm">
            خروجی CSV
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconWallet} label="درآمد کل" value={money(s?.revenue_cents ?? 0)} />
        <StatCard icon={IconChart} label="درآمد ۳۰ روز" value={money(s?.revenue_30d_cents ?? 0)} />
        <StatCard icon={IconTicket} label="میانگین سفارش" value={money(avg)} hint={`${faNum(paid)} سفارش پرداخت‌شده`} />
        <StatCard icon={IconUsers} label="کاربران" value={faNum((s?.users ?? 0).toLocaleString("en-US"))} tone="ink" />
      </div>

      <section className="card mt-6 p-6">
        <h2 className="text-sm font-black text-ink">روند درآمد روزانه</h2>
        <div className="mt-6">
          {s?.daily?.length ? (
            <BarChart data={s.daily} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-ink-muted">
              داده‌ای برای نمایش نیست
            </div>
          )}
        </div>
      </section>

      <h2 className="mb-3 mt-8 text-sm font-black text-ink">درآمد به تفکیک مسابقه</h2>
      <Table head={["مسابقه", "پیشنهاد فروخته‌شده", "درآمد", "سهم"]}>
        {rows.length === 0 && <Empty>هنوز فروشی ثبت نشده است.</Empty>}
        {rows.map(([name, v]) => {
          const totalCents = rows.reduce((a, [, x]) => a + x.cents, 0) || 1;
          const share = Math.round((v.cents / totalCents) * 100);
          return (
            <tr key={name} className="hover:bg-canvas-alt/40">
              <td className="px-4 py-3 font-bold text-ink">{name}</td>
              <td className="ltr-nums px-4 py-3 text-ink-soft">{faNum(v.qty)}</td>
              <td className="ltr-nums px-4 py-3 font-bold text-ink">{money(v.cents)}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-canvas-alt">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${share}%` }} />
                  </div>
                  <span className="ltr-nums text-xs text-ink-muted">{faNum(share)}٪</span>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
    </>
  );
}
