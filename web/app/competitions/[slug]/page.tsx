"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  api, faNum, money, timeLeft,
  type Competition, type CompetitionResult, type JudgeStatus,
} from "@/lib/api";
import { FALLBACK_COMPETITIONS } from "@/lib/fallback";
import { Markdown } from "@/components/Markdown";
import { SpotBoard } from "@/components/SpotBoard";
import { IconCheck, IconLock, IconShield, IconTrophy, IconUsers } from "@/components/icons";

export default function CompetitionPage({ params }: { params: { slug: string } }) {
  const [c, setC] = useState<Competition | null>(null);
  const [result, setResult] = useState<CompetitionResult | null>(null);
  const [panel, setPanel] = useState<JudgeStatus[]>([]);

  useEffect(() => {
    api.competition(params.slug)
      .then(setC)
      .catch(() => setC(FALLBACK_COMPETITIONS.find((x) => x.slug === params.slug) || null));
    api.result(params.slug)
      .then((r) => { setResult(r.result); setPanel(r.panel || []); })
      .catch(() => {});
  }, [params.slug]);

  if (!c) return <div className="py-24 text-center text-ink-muted">در حال بارگذاری…</div>;

  const open = c.status === "open";
  const settled = c.status === "settled" && result;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className="card overflow-hidden">
            <div className="aspect-[16/10] bg-canvas-alt">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.prize?.hero_image || c.board_image}
                alt={c.prize?.title || c.title}
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {c.prize?.media && c.prize.media.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-3">
              {c.prize.media.slice(0, 4).map((m) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.id}
                  src={m.url}
                  alt={m.caption}
                  className="aspect-square rounded-xl object-cover"
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <span className={`chip ${open ? "bg-brand-100 text-brand-700" : "bg-canvas-alt text-ink-soft"}`}>
            {open ? `${timeLeft(c.closes_at)} تا پایان` : settled ? "نتیجه اعلام شد" : "بسته"}
          </span>

          <h1 className="mt-4 text-3xl font-black leading-tight text-ink">
            {c.prize?.title || c.title}
          </h1>
          <p className="mt-2 text-ink-muted">{c.prize?.subtitle}</p>

          <dl className="mt-7 grid grid-cols-2 gap-4">
            <Cell label="هر پیشنهاد" value={money(c.ticket_price_cents, c.currency)} />
            <Cell label="ارزش جایزه" value={c.prize ? money(c.prize.value_cents, c.currency) : "—"} />
            <Cell label="سقف هر کاربر" value={faNum(c.max_entries_user)} />
            <Cell label="شرکت‌کننده‌ها" value={faNum((c.entry_count ?? 0).toLocaleString("en-US"))} />
          </dl>

          <Link
            href={`/play/${c.slug}`}
            className={`${open ? "btn-primary" : "btn-ghost"} mt-7 w-full`}
          >
            {open ? "ثبت پیشنهاد" : "مشاهدهٔ تصویر مسابقه"}
          </Link>
        </div>
      </div>

      {/* ---- توضیح جایزه ---- */}
      {c.prize?.body_md && (
        <section className="mt-14 max-w-3xl">
          <h2 className="text-xl font-black text-ink">دربارهٔ این جایزه</h2>
          <div className="mt-4">
            <Markdown source={c.prize.body_md} />
          </div>
        </section>
      )}

      {/* ---- داوری ---- */}
      <section className="mt-14">
        <h2 className="text-xl font-black text-ink">وضعیت داوری</h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">
          هر داور پیش از بسته‌شدن مسابقه هش نقطهٔ خود را ثبت می‌کند. پس از
          بسته‌شدن، نقطه و مقدار تصادفی منتشر می‌شود تا هر کسی بتواند هش را
          بازمحاسبه کند.
        </p>

        {panel.length === 0 ? (
          <p className="card mt-5 p-8 text-center text-sm text-ink-muted">
            اطلاعات هیئت داوران پس از باز شدن دورهٔ داوری منتشر می‌شود.
          </p>
        ) : (
          <div className="card mt-5 divide-y divide-ink/[.07]">
            {panel.map((j) => (
              <div key={j.judge_id} className="flex items-center gap-4 p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-canvas-alt text-ink-soft">
                  <IconUsers className="h-5 w-5" />
                </span>
                <p className="flex-1 text-sm font-bold text-ink">{j.display_name}</p>
                <span className={`chip ${j.committed ? "bg-emerald-50 text-emerald-700" : "bg-canvas-alt text-ink-muted"}`}>
                  {j.committed ? <IconLock className="h-3.5 w-3.5" /> : null}
                  {j.committed ? "قفل‌شده" : "در انتظار"}
                </span>
                {j.revealed ? (
                  <span className="ltr-nums chip bg-brand-50 text-brand-700">
                    <IconCheck className="h-3.5 w-3.5" />
                    {j.x?.toFixed(4)} , {j.y?.toFixed(4)}
                  </span>
                ) : (
                  <span className="chip bg-canvas-alt text-ink-muted">افشا نشده</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ---- نتیجه ---- */}
      {settled && (
        <section className="mt-14">
          <h2 className="text-xl font-black text-ink">نتیجه</h2>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <SpotBoard
              image={c.board_image}
              markers={[]}
              onAdd={() => {}}
              onRemove={() => {}}
              readOnly
              reveal={{ x: result.final_x, y: result.final_y }}
            />
            <div className="card p-7">
              <IconTrophy className="h-8 w-8 text-brand-600" />
              <h3 className="mt-4 text-lg font-black text-ink">
                {result.winner_name || "برنده"}
              </h3>
              <dl className="mt-5 space-y-3 text-sm">
                <Row k="نقطهٔ نهایی داوران" v={`${result.final_x?.toFixed(4)} , ${result.final_y?.toFixed(4)}`} />
                <Row k="فاصلهٔ پیشنهاد برنده" v={result.distance?.toFixed(5)} />
                <Row k="تاریخ اعلام" v={new Date(result.decided_at).toLocaleDateString("fa-IR")} />
              </dl>
              <p className="mt-5 flex items-start gap-2 text-xs leading-6 text-ink-muted">
                <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                زنجیرهٔ هش پیشنهادهای این مسابقه بررسی و سالم تأیید شد.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="ltr-nums mt-1 font-black text-ink">{value}</dd>
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
