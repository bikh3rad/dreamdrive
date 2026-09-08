"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, faNum, money, type Order } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { IconWallet, IconFile } from "@/components/icons";

const STATUS: Record<string, { label: string; cls: string }> = {
  paid: { label: "پرداخت‌شده", cls: "bg-emerald-50 text-emerald-700" },
  pending: { label: "در انتظار", cls: "bg-amber-50 text-amber-700" },
  failed: { label: "ناموفق", cls: "bg-red-50 text-red-700" },
  refunded: { label: "بازگشت‌داده‌شده", cls: "bg-canvas-alt text-ink-soft" },
  free: { label: "رایگان", cls: "bg-brand-50 text-brand-700" },
};

export default function WalletPage() {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!user) return;
    api.myOrders().then((r) => setOrders(r.orders || [])).catch(() => {});
  }, [user]);

  if (loading) return <div className="py-24 text-center text-ink-muted">…</div>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">ابتدا وارد شو</h1>
        <Link href="/login?next=/wallet" className="btn-primary mt-6">ورود</Link>
      </div>
    );

  const spent = orders
    .filter((o) => o.status === "paid")
    .reduce((s, o) => s + o.total_cents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">حساب من</p>
      <h1 className="h-section mt-2">کیف پول</h1>

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        <div className="card bg-ink p-7 text-white">
          <div className="flex items-center gap-2 text-brand-300">
            <IconWallet className="h-5 w-5" />
            <span className="text-sm font-bold">اعتبار قابل استفاده</span>
          </div>
          <p className="ltr-nums mt-4 text-4xl font-black">
            {money(user.credit_cents)}
          </p>
          <p className="mt-3 text-xs leading-6 text-white/60">
            اعتبار از «پاداش نزدیک‌ترین حدس» و بازگشت وجه می‌آید و هنگام پرداخت
            به‌صورت خودکار اعمال می‌شود.
          </p>
        </div>

        <div className="card p-7">
          <p className="text-sm font-bold text-ink-muted">مجموع پرداختی</p>
          <p className="ltr-nums mt-4 text-4xl font-black text-ink">{money(spent)}</p>
          <p className="mt-3 text-xs leading-6 text-ink-muted">
            در <span className="ltr-nums font-bold">{faNum(orders.length)}</span> سفارش.
          </p>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-black text-ink">تاریخچهٔ سفارش‌ها</h2>

      {orders.length === 0 ? (
        <p className="card mt-4 p-10 text-center text-sm text-ink-muted">
          هنوز سفارشی ثبت نشده است.
        </p>
      ) : (
        <div className="card mt-4 divide-y divide-ink/[.07]">
          {orders.map((o) => {
            const s = STATUS[o.status] || STATUS.pending;
            return (
              <div key={o.id} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas-alt text-ink-soft">
                  <IconFile className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <code className="ltr-nums block truncate text-xs text-ink-muted">
                    {o.id.slice(0, 8)}
                  </code>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {new Date(o.created_at).toLocaleDateString("fa-IR")}
                  </p>
                </div>
                <span className={`chip ${s.cls}`}>{s.label}</span>
                <span className="ltr-nums w-24 text-end text-sm font-black text-ink">
                  {money(o.total_cents, o.currency)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
