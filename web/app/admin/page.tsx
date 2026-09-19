"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  activeLevels, api, faNum, money, startingPrice, timeLeft,
  type Competition, type Stats,
} from "@/lib/api";
import {
  PageHead, StatCard, Table, Empty, Badge, BarChart,
  statusLabel, statusTone,
} from "@/components/admin/ui";
import {
  IconUsers, IconTicket, IconWallet, IconCalendar, IconShield, IconTarget,
} from "@/components/icons";

export default function AdminDashboard() {
  const [s, setS] = useState<Stats | null>(null);
  const [comps, setComps] = useState<Competition[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    api.admin.stats().then(setS).catch(() => {});
    api.admin.competitions().then((r) => setComps(r.competitions || [])).catch(() => {});
    api.admin.audit(6).then((r) => setAudit(r.entries || [])).catch(() => {});
  }, []);

  const soon = comps
    .filter((c) => c.status === "open")
    .sort((a, b) => +new Date(a.closes_at) - +new Date(b.closes_at));
  const needsAction = comps.filter((c) => c.status === "closed" || c.status === "judging");

  return (
    <>
      <PageHead
        title="داشبورد"
        subtitle="نمای کلی از وضعیت مسابقه‌ها، درآمد و کارهایی که منتظر تصمیم شما هستند."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={IconUsers} label="کاربران" value={faNum((s?.users ?? 0).toLocaleString("en-US"))} />
        <StatCard icon={IconCalendar} label="مسابقه‌های باز" value={faNum(s?.open_competitions ?? 0)} />
        <StatCard icon={IconTicket} label="کل پیشنهادها" value={faNum((s?.entries_total ?? 0).toLocaleString("en-US"))} />
        <StatCard
          icon={IconWallet}
          label="درآمد ۳۰ روز"
          value={money(s?.revenue_30d_cents ?? 0)}
          hint={`مجموع کل: ${money(s?.revenue_cents ?? 0)}`}
        />
      </div>

      {needsAction.length > 0 && (
        <div className="card mt-6 border-brand-300 bg-brand-50 p-5">
          <div className="flex items-start gap-3">
            <IconTarget className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div className="flex-1">
              <p className="font-black text-ink">
                <span className="ltr-nums">{faNum(needsAction.length)}</span> مسابقه منتظر داوری یا تسویه است
              </p>
              <p className="mt-1 text-sm text-ink-soft">
                پیش از تسویه، رأی همهٔ داوران باید افشا شده و زنجیرهٔ هش پیشنهادها بررسی شود.
              </p>
            </div>
            <Link href="/admin/judging" className="btn-dark !py-2 !px-4 text-xs">
              رفتن به پنل داوری
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <h2 className="text-sm font-black text-ink">درآمد ۳۰ روز گذشته</h2>
          <p className="mt-1 text-xs text-ink-muted">
            <span className="ltr-nums font-bold">{faNum(s?.orders_30d ?? 0)}</span> سفارش
          </p>
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

        <section className="card p-6">
          <div className="flex items-center gap-2">
            <IconShield className="h-4 w-4 text-ink-muted" />
            <h2 className="text-sm font-black text-ink">آخرین اقدام‌های مدیریتی</h2>
          </div>
          <ul className="mt-4 space-y-3">
            {audit.length === 0 && <li className="text-xs text-ink-muted">موردی ثبت نشده است.</li>}
            {audit.map((a, i) => (
              <li key={i} className="flex gap-3 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                <div>
                  <p className="font-bold text-ink">{a.action}</p>
                  <p className="mt-0.5 text-ink-muted">
                    {a.actor_email || "—"} ·{" "}
                    {a.created_at ? new Date(a.created_at).toLocaleString("fa-IR") : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <Link href="/admin/audit" className="mt-5 inline-block text-xs font-bold text-brand-600 hover:underline">
            گزارش کامل ممیزی
          </Link>
        </section>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-black text-ink">مسابقه‌های در جریان</h2>
      <Table head={["عنوان", "وضعیت", "قیمت", "پایان", "شرکت", ""]}>
        {soon.length === 0 && <Empty>مسابقهٔ بازی وجود ندارد.</Empty>}
        {soon.map((c) => (
          <tr key={c.id} className="hover:bg-canvas-alt/40">
            <td className="px-4 py-3 font-bold text-ink">{c.prize?.title || c.title}</td>
            <td className="px-4 py-3">
              <Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>
            </td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">
              {activeLevels(c).length > 1 && <span className="text-ink-muted">از </span>}
              {money(startingPrice(c) ?? 0, c.currency)}
            </td>
            <td className="px-4 py-3 text-ink-soft">{timeLeft(c.closes_at)}</td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">
              {faNum((c.entry_count ?? 0).toLocaleString("en-US"))}
              {c.entry_target > 0 && (
                <span className="text-ink-muted">
                  {" / "}
                  {faNum(c.entry_target.toLocaleString("en-US"))}
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-end">
              <Link href="/admin/competitions" className="text-xs font-bold text-brand-600 hover:underline">
                مدیریت
              </Link>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}
