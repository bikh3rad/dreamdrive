"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useAuth } from "@/components/AuthProvider";
import { api, faNum, money, ApiError } from "@/lib/api";
import { IconTicket, IconX, IconWallet } from "@/components/icons";

export default function CartPage() {
  const { picks, removeAt, clear, totalCents, lines } = useCart();
  const { user, refresh } = useAuth();
  const router = useRouter();

  const [useCredit, setUseCredit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  // واحد پول از خود اقلام گرفته می‌شود، نه پیش‌فرض تابع؛ اگر مسابقه‌ای با ارز
  // دیگری ساخته شود، جمع سبد نباید ناگهان «ریال» برچسب بخورد.
  const currency = picks[0]?.currency || "IRR";
  const credit = user?.credit_cents ?? 0;
  const applied = useCredit ? Math.min(credit, totalCents) : 0;
  const due = totalCents - applied;

  const pay = async () => {
    if (!user) return router.push("/login?next=/cart");
    setBusy(true); setErr("");
    try {
      const { order } = await api.checkout(lines(), useCredit);
      clear();
      await refresh();
      router.push(`/orders/${order.id}?new=1`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "پرداخت ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  if (picks.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
        <IconTicket className="mx-auto h-12 w-12 text-ink-muted" />
        <h1 className="mt-5 text-2xl font-black text-ink">سبد خالی است</h1>
        <p className="mt-2 text-sm text-ink-muted">
          یک مسابقه را باز کن، نقطه‌ات را انتخاب کن و به سبد اضافه کن.
        </p>
        <Link href="/competitions" className="btn-primary mt-7">دیدن مسابقه‌ها</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="h-section">سبد پیشنهادها</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="card divide-y divide-ink/[.07]">
          {picks.map((p, i) => (
            <div key={i} className="flex items-center gap-4 p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-sm font-black text-brand-700">
                {faNum(i + 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-ink">{p.competitionTitle}</p>
                {/* جایزهٔ هر حدس باید پیش از پرداخت دیده شود: در یک مسابقه
                    می‌توان چند حدس با جوایز مختلف داشت و بعد از ثبت، جایزهٔ
                    یک حدس قابل تغییر نیست. */}
                {p.prizeTitle && (
                  <p className="truncate text-xs font-bold text-brand-700">{p.prizeTitle}</p>
                )}
                <p className="ltr-nums mt-0.5 text-xs text-ink-muted">
                  x {p.x.toFixed(4)} · y {p.y.toFixed(4)}
                </p>
              </div>
              <span className="ltr-nums text-sm font-bold text-ink">
                {money(p.priceCents, p.currency)}
              </span>
              <button onClick={() => removeAt(i)} className="rounded-lg p-2 text-ink-muted hover:bg-canvas-alt hover:text-ink" title="حذف">
                <IconX className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <aside className="card h-fit p-6 lg:sticky lg:top-24">
          <h2 className="text-sm font-black text-ink">خلاصهٔ سفارش</h2>

          <div className="mt-5 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">
                <span className="ltr-nums font-bold">{faNum(picks.length)}</span> پیشنهاد
              </span>
              <span className="ltr-nums font-bold">{money(totalCents, currency)}</span>
            </div>
            {credit > 0 && (
              <div className="flex justify-between text-brand-700">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)}
                    className="h-4 w-4 accent-[#F0A828]" />
                  <IconWallet className="h-4 w-4" />
                  اعتبار کیف پول
                </label>
                <span className="ltr-nums font-bold">− {money(applied, currency)}</span>
              </div>
            )}
          </div>

          <div className="my-5 h-px bg-ink/[.07]" />

          <div className="flex items-baseline justify-between">
            <span className="font-black text-ink">قابل پرداخت</span>
            <span className="ltr-nums text-xl font-black text-brand-600">{money(due, currency)}</span>
          </div>

          {err && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

          <button onClick={pay} disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? "در حال ثبت…" : "پرداخت و ثبت پیشنهادها"}
          </button>

          <p className="mt-3 text-center text-[11px] leading-6 text-ink-muted">
            با پرداخت، قوانین مسابقه را می‌پذیری. پیشنهادها پس از ثبت قابل تغییر نیستند.
          </p>
        </aside>
      </div>
    </div>
  );
}
