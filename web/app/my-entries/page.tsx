"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, faNum, type Competition, type Entry } from "@/lib/api";
import { useAuth } from "@/components/AuthProvider";
import { IconGift, IconTicket, IconTarget } from "@/components/icons";

export default function MyEntriesPage() {
  const { user, loading } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [comps, setComps] = useState<Record<string, Competition>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([api.myEntries(), api.competitions(true)])
      .then(([e, c]) => {
        setEntries(e.entries || []);
        setComps(Object.fromEntries((c.competitions || []).map((x) => [x.id, x])));
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [user]);

  if (loading) return <P>در حال بارگذاری…</P>;
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">ابتدا وارد شو</h1>
        <Link href="/login?next=/my-entries" className="btn-primary mt-6">ورود</Link>
      </div>
    );

  const paid = entries.filter((e) => !e.is_free_entry).length;
  const free = entries.filter((e) => e.is_free_entry).length;

  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.competition_id] ||= []).push(e);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="eyebrow">حساب من</p>
      <h1 className="h-section mt-2">شرکت‌های من</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat icon={IconTicket} label="کل پیشنهادها" value={entries.length} />
        <Stat icon={IconTarget} label="پرداختی" value={paid} />
        <Stat icon={IconGift} label="ورود رایگان" value={free} />
      </div>

      {ready && entries.length === 0 && (
        <div className="card mt-8 p-12 text-center">
          <p className="text-sm text-ink-muted">هنوز پیشنهادی ثبت نکرده‌ای.</p>
          <Link href="/competitions" className="btn-primary mt-6">شروع کن</Link>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {Object.entries(grouped).map(([compId, list]) => {
          const c = comps[compId];
          return (
            <section key={compId} className="card overflow-hidden">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/[.07] p-5">
                <div>
                  <h2 className="font-black text-ink">
                    {c?.prize?.title || c?.title || "مسابقه"}
                  </h2>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    <span className="ltr-nums font-bold">{faNum(list.length)}</span> پیشنهاد
                  </p>
                </div>
                <span className={`chip ${c?.status === "open" ? "bg-brand-100 text-brand-700" : "bg-canvas-alt text-ink-soft"}`}>
                  {c?.status === "open" ? "در جریان" : c?.status === "settled" ? "نتیجه اعلام شد" : "بسته"}
                </span>
              </header>

              <div className="divide-y divide-ink/[.05]">
                {list.map((e) => (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
                    <span className="ltr-nums w-10 shrink-0 text-xs font-bold text-ink-muted">
                      #{faNum(e.seq)}
                    </span>
                    <span className="ltr-nums flex-1 font-bold text-ink">
                      {e.x.toFixed(4)} , {e.y.toFixed(4)}
                    </span>
                    {e.is_free_entry && (
                      <span className="chip bg-brand-50 text-brand-700">رایگان</span>
                    )}
                    <code
                      className="ltr-nums hidden max-w-[10rem] truncate text-[11px] text-ink-muted sm:block"
                      title={e.hash}
                    >
                      {e.hash?.slice(0, 16)}…
                    </code>
                  </div>
                ))}
              </div>

              {c && (
                <footer className="border-t border-ink/[.07] bg-canvas-alt/60 px-5 py-3">
                  <Link href={`/competitions/${c.slug}`} className="text-xs font-bold text-brand-600 hover:underline">
                    جزئیات و نتیجهٔ مسابقه
                  </Link>
                </footer>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="ltr-nums text-2xl font-black text-ink">{faNum(value)}</p>
        <p className="text-xs text-ink-muted">{label}</p>
      </div>
    </div>
  );
}

const P = ({ children }: { children: React.ReactNode }) => (
  <div className="mx-auto max-w-5xl px-4 py-24 text-center text-ink-muted">{children}</div>
);
