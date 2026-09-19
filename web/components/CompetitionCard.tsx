"use client";

import Link from "next/link";
import { activeLevels, faNum, money, startingPrice, timeLeft, type Competition } from "@/lib/api";
import { IconTicket, IconCalendar } from "./icons";

export function CompetitionCard({ c }: { c: Competition }) {
  const closed = c.status !== "open";
  return (
    <article className="card group overflow-hidden transition hover:shadow-lift">
      <div className="relative aspect-[16/10] overflow-hidden bg-canvas-alt">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={c.prize?.hero_image || c.board_image}
          alt={c.prize?.title || c.title}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
        />
        <span
          className={`chip absolute end-3 top-3 backdrop-blur ${
            closed ? "bg-ink/80 text-white" : "bg-brand-500 text-ink"
          }`}
        >
          {closed ? "بسته" : `${timeLeft(c.closes_at)} تا پایان`}
        </span>
      </div>

      <div className="p-5">
        <h3 className="text-lg font-black leading-snug text-ink">
          {c.prize?.title || c.title}
        </h3>
        {c.prize?.subtitle && (
          <p className="mt-1.5 text-sm leading-6 text-ink-muted">{c.prize.subtitle}</p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-muted">
          <span className="flex items-center gap-1.5">
            <IconTicket className="h-4 w-4" />
            {/* چند سطح قیمت ممکن است؛ ارزان‌ترین را با «از» نشان می‌دهیم. */}
            {activeLevels(c).length > 1 && <span>از</span>}
            <span className="ltr-nums font-bold text-ink">
              {money(startingPrice(c) ?? 0, c.currency)}
            </span>
            هر پیشنهاد
          </span>
          {/* entry_count دیگر omitempty ندارد، پس از API همیشه می‌آید (صفر هم
              مقدار معتبری است). شرط باقی می‌ماند چون این کامپوننت دادهٔ
              fallback و دادهٔ فهرست‌های دیگر را هم رندر می‌کند که این فیلد را
              ندارند؛ بدون آن، نوار ظرفیتِ پایین بی‌برچسب و شبیه خرابی رندر
              دیده می‌شد. */}
          {(typeof c.entry_count === "number" || c.entry_target > 0) && (
            <span className="flex items-center gap-1.5">
              <IconCalendar className="h-4 w-4" />
              <span className="ltr-nums font-bold text-ink">
                {faNum((c.entry_count ?? 0).toLocaleString("en-US"))}
              </span>
              {c.entry_target > 0 ? (
                <span className="ltr-nums">
                  / {faNum(c.entry_target.toLocaleString("en-US"))}
                </span>
              ) : null}
              شرکت
            </span>
          )}
        </div>

        {/* نوار ظرفیت دوره — فقط وقتی سقف تعریف شده و مسابقه هنوز باز است.
            روی مسابقهٔ بسته معنایی ندارد و فقط شلوغی می‌سازد. */}
        {c.entry_target > 0 && !closed && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-brand-500"
              style={{
                width: `${Math.min(100, ((c.entry_count ?? 0) / c.entry_target) * 100)}%`,
              }}
            />
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <Link href={`/play/${c.slug}`} className="btn-primary flex-1 !py-2.5 text-sm">
            {closed ? "مشاهدهٔ نتیجه" : "بازی کن"}
          </Link>
          <Link href={`/competitions/${c.slug}`} className="btn-ghost !px-4 !py-2.5 text-sm">
            جزئیات
          </Link>
        </div>
      </div>
    </article>
  );
}
