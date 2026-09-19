"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, faNum, money, type Order } from "@/lib/api";
import { IconCheck, IconFile } from "@/components/icons";

function OrderView({ id }: { id: string }) {
  const isNew = useSearchParams().get("new") === "1";
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    api.myOrders()
      .then((r) => setOrder((r.orders || []).find((o) => o.id === id) || null))
      .catch(() => {});
  }, [id]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      {isNew && (
        <div className="card mb-6 flex items-center gap-4 bg-brand-50 p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-ink">
            <IconCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-black text-ink">پیشنهادهایت ثبت شد</p>
            <p className="mt-1 text-sm text-ink-muted">
              نتیجه پس از افشای رأی هیئت داوران به ایمیلت اعلام می‌شود.
            </p>
          </div>
        </div>
      )}

      <div className="card p-7">
        <div className="flex items-center gap-3">
          <IconFile className="h-5 w-5 text-ink-muted" />
          <h1 className="text-lg font-black text-ink">جزئیات سفارش</h1>
        </div>
        <code className="ltr-nums mt-2 block text-xs text-ink-muted">{id}</code>

        {order ? (
          <>
            <dl className="mt-6 space-y-3 text-sm">
              <Row k="وضعیت" v={order.status} />
              <Row k="تاریخ" v={new Date(order.created_at).toLocaleString("fa-IR")} />
              <Row k="مبلغ" v={money(order.total_cents, order.currency)} />
            </dl>

            {order.items && order.items.length > 0 && (
              <div className="mt-6 divide-y divide-ink/[.07] border-t border-ink/[.07] pt-2">
                {order.items.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">
                        {it.title || it.competition_slug}
                      </span>
                      {it.prize_title && (
                        <span className="block truncate text-xs font-bold text-brand-700">
                          {it.prize_title}
                        </span>
                      )}
                    </span>
                    <span className="ltr-nums shrink-0 text-ink-muted">
                      {faNum(it.qty)} × {money(it.unit_price_cents, order.currency)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="mt-6 text-sm text-ink-muted">در حال بارگذاری…</p>
        )}

        <div className="mt-7 flex gap-3">
          <Link href="/my-entries" className="btn-primary flex-1 !py-2.5 text-sm">
            دیدن پیشنهادهایم
          </Link>
          <Link href="/competitions" className="btn-ghost !py-2.5 text-sm">
            مسابقه‌های دیگر
          </Link>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="ltr-nums font-bold text-ink">{v}</dd>
    </div>
  );
}

export default function OrderPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="py-24 text-center text-ink-muted">…</div>}>
      <OrderView id={params.id} />
    </Suspense>
  );
}
