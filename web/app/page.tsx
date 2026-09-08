"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, faNum, money, timeLeft, type Competition, type Winner } from "@/lib/api";
import { FALLBACK_COMPETITIONS, FALLBACK_WINNERS } from "@/lib/fallback";
import { CompetitionCard } from "@/components/CompetitionCard";
import {
  IconTarget, IconTrophy, IconShield, IconScale, IconGift,
  IconUsers, IconCheck, IconPin, IconGlobe,
} from "@/components/icons";

const STEPS = [
  { n: "۱", t: "عکس را باز کن", d: "یک قاب واقعی از یک بازی، بدون توپ. تصویر با کیفیت بالا و قابل بزرگ‌نمایی است." },
  { n: "۲", t: "نقطه را انتخاب کن", d: "با نگاه به مسیر نگاه بازیکنان و حرکت بدن‌ها، مرکز توپ را حدس بزن." },
  { n: "۳", t: "پیشنهادت را ثبت کن", d: "هر پیشنهاد یک بلیط است. می‌توانی چند نقطه ثبت کنی یا از مسیر رایگان استفاده کنی." },
  { n: "۴", t: "منتظر رأی داوران بمان", d: "هیئت داوران مستقل پیش از بسته‌شدن، نقطهٔ خود را قفل می‌کند و پس از آن آشکار می‌شود." },
];

const PACKS = [
  { n: 1, price: 300, label: "تک پیشنهاد", note: "برای امتحان کردن" },
  { n: 5, price: 1200, label: "بستهٔ پنج‌تایی", note: "محبوب‌ترین", best: true },
  { n: 20, price: 4000, label: "بستهٔ بیست‌تایی", note: "بهترین ارزش" },
];

const TRUST = [
  { icon: IconScale, t: "مهارت، نه شانس", d: "برنده بر اساس نزدیکی به رأی هیئت داوران انتخاب می‌شود. هیچ قرعه‌کشی‌ای در کار نیست." },
  { icon: IconShield, t: "نقطه از قبل قفل می‌شود", d: "داوران پیش از بسته‌شدن مسابقه هش نقطهٔ خود را ثبت می‌کنند. حتی مدیران سایت هم پاسخ را نمی‌دانند." },
  { icon: IconGift, t: "مسیر ورود رایگان", d: "می‌توانی بدون هیچ پرداختی از راه پست شرکت کنی. شانس ورود رایگان دقیقاً برابر است." },
];

export default function HomePage() {
  const [comps, setComps] = useState<Competition[]>(FALLBACK_COMPETITIONS);
  const [winners, setWinners] = useState<Winner[]>(FALLBACK_WINNERS);

  useEffect(() => {
    api.competitions()
      .then((r) => { if (r.competitions?.length) setComps(r.competitions); })
      .catch(() => {});
    api.winners()
      .then((r) => { if (r.winners?.length) setWinners(r.winners); })
      .catch(() => {});
  }, []);

  const featured = comps[0];

  return (
    <>
      {/* ---------- قهرمان ---------- */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-canvas-alt to-canvas" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24">
          <div>
            <span className="chip bg-brand-100 text-brand-700">
              <IconTarget className="h-4 w-4" />
              رقابت مهارتی نشانه‌گذاری توپ
            </span>

            <h1 className="mt-5 text-4xl font-black leading-[1.15] text-ink sm:text-5xl lg:text-6xl">
              یک نقطه فاصله‌ات است تا
              <span className="relative mx-2 inline-block text-brand-600">
                هفتهٔ رویایی
                <svg className="absolute -bottom-1 start-0 w-full" height="10" viewBox="0 0 200 10" preserveAspectRatio="none" aria-hidden>
                  <path d="M2 7c50-5 120-5 196 0" stroke="#F0A828" strokeWidth="3" fill="none" strokeLinecap="round" />
                </svg>
              </span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-ink-soft">
              مرکز توپ گم‌شده را در تصویر پیدا کن. نزدیک‌ترین پیشنهاد به رأی هیئت
              داوران مستقل، یک هفته اقامت در ویلایی لوکس در اروپا به‌همراه خودروی
              رویایی می‌برد.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={featured ? `/play/${featured.slug}` : "/competitions"} className="btn-primary">
                همین حالا بازی کن
              </Link>
              <Link href="/how-it-works" className="btn-ghost">
                چطور کار می‌کند؟
              </Link>
            </div>

            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6">
              {[
                ["۱۸۴", "برندهٔ تاکنون"],
                ["۹", "کشور اروپایی"],
                ["CA$۳", "شروع از"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="ltr-nums text-2xl font-black text-ink">{v}</dt>
                  <dd className="mt-1 text-xs text-ink-muted">{l}</dd>
                </div>
              ))}
            </dl>
          </div>

          {featured && (
            <div className="relative">
              <div className="card overflow-hidden">
                <div className="relative aspect-[4/3] bg-canvas-alt">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={featured.prize?.hero_image || featured.board_image}
                    alt={featured.prize?.title || featured.title}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 to-transparent p-5 pt-14 text-white">
                    <p className="text-xs font-bold text-brand-300">جایزهٔ این هفته</p>
                    <h2 className="mt-1 text-xl font-black">
                      {featured.prize?.title || featured.title}
                    </h2>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 p-5">
                  <div>
                    <p className="text-xs text-ink-muted">زمان باقی‌مانده</p>
                    <p className="mt-0.5 font-black text-ink">{timeLeft(featured.closes_at)}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-xs text-ink-muted">هر پیشنهاد</p>
                    <p className="ltr-nums mt-0.5 font-black text-brand-600">
                      {money(featured.ticket_price_cents, featured.currency)}
                    </p>
                  </div>
                  <Link href={`/play/${featured.slug}`} className="btn-primary !px-5 !py-2.5 text-sm">
                    بازی
                  </Link>
                </div>
              </div>

              <div className="absolute -start-4 -top-4 hidden rounded-full bg-white px-4 py-2 text-xs font-bold shadow-lift lg:flex lg:items-center lg:gap-2">
                <IconUsers className="h-4 w-4 text-brand-500" />
                <span className="ltr-nums">
                  {faNum((featured.entry_count ?? 0).toLocaleString("en-US"))}
                </span>
                نفر شرکت کرده‌اند
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- چطور کار می‌کند ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">ساده است</p>
          <h2 className="h-section mt-2">چطور کار می‌کند</h2>
          <p className="mt-3 text-ink-muted">
            چهار قدم از باز کردن تصویر تا اعلام نتیجه. همه‌چیز شفاف و قابل بررسی است.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-base font-black text-brand-700">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-black text-ink">{s.t}</h3>
              <p className="mt-2 text-sm leading-7 text-ink-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- مسابقه‌های باز ---------- */}
      <section className="bg-canvas-alt py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-xl">
              <p className="eyebrow">در جریان</p>
              <h2 className="h-section mt-2">مسابقه‌های باز</h2>
            </div>
            <Link href="/competitions" className="btn-ghost !py-2.5 text-sm">
              همهٔ مسابقه‌ها
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {comps.slice(0, 3).map((c) => (
              <CompetitionCard key={c.id} c={c} />
            ))}
          </div>
        </div>
      </section>

      {/* ---------- بسته‌های پیشنهاد ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">قیمت‌گذاری</p>
          <h2 className="h-section mt-2">بسته‌های پیشنهاد</h2>
          <p className="mt-3 text-ink-muted">
            هر پیشنهاد یک نقطه روی تصویر است. هرچه نقطه‌های بیشتری ثبت کنی، شانس
            نزدیک‌شدن به رأی داوران بیشتر می‌شود.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-3">
          {PACKS.map((p) => (
            <div
              key={p.n}
              className={`card relative p-7 text-center ${
                p.best ? "ring-2 ring-brand-500 md:-translate-y-3" : ""
              }`}
            >
              {p.best && (
                <span className="chip absolute -top-3 start-1/2 -translate-x-1/2 bg-brand-500 text-ink">
                  {p.note}
                </span>
              )}
              <p className="text-sm font-bold text-ink-muted">{p.label}</p>
              <p className="ltr-nums mt-3 text-4xl font-black text-ink">
                {money(p.price)}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                <span className="ltr-nums font-bold text-ink">{faNum(p.n)}</span> پیشنهاد
                {p.n > 1 && (
                  <>
                    {" · "}
                    <span className="ltr-nums">{money(Math.round(p.price / p.n))}</span> هرکدام
                  </>
                )}
              </p>
              <ul className="mt-6 space-y-2.5 text-start text-sm text-ink-soft">
                {["اعتبار نزدیک‌ترین حدس", "اعلان ایمیلی نتیجه", "تاریخچهٔ کامل پیشنهادها"].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={featured ? `/play/${featured.slug}` : "/competitions"}
                className={`${p.best ? "btn-primary" : "btn-dark"} mt-7 w-full !py-2.5 text-sm`}
              >
                انتخاب بسته
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-ink-muted">
          نمی‌خواهی پرداختی داشته باشی؟{" "}
          <Link href="/free-entry" className="font-bold text-brand-600 hover:underline">
            از مسیر ورود رایگان شرکت کن
          </Link>
        </p>
      </section>

      {/* ---------- برندگان ---------- */}
      <section className="bg-ink py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-bold text-brand-400">داستان‌های واقعی</p>
            <h2 className="mt-2 text-3xl font-black sm:text-4xl">رویاها به واقعیت رسید</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {winners.slice(0, 3).map((w) => (
              <article key={w.competition_slug} className="overflow-hidden rounded-card bg-white/[.06] ring-1 ring-white/10">
                <div className="aspect-[16/10] bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.hero_image} alt={w.prize_title} className="h-full w-full object-cover" />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-brand-300">
                    <IconGlobe className="h-4 w-4" />
                    {w.country}
                  </div>
                  <h3 className="mt-2 text-base font-black">{w.winner_name}</h3>
                  <p className="mt-1 text-sm text-white/60">{w.prize_title}</p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10">
            <Link href="/winners" className="btn-primary">
              <IconTrophy className="h-4 w-4" />
              همهٔ برندگان
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- اعتماد ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="max-w-2xl">
          <p className="eyebrow">چرا می‌توانی مطمئن باشی</p>
          <h2 className="h-section mt-2">بازی منصفانه، قابل اثبات</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {TRUST.map((t) => (
            <div key={t.t} className="card p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <t.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-black text-ink">{t.t}</h3>
              <p className="mt-2 text-sm leading-7 text-ink-muted">{t.d}</p>
            </div>
          ))}
        </div>

        <div className="card mt-10 flex flex-col items-center gap-5 bg-brand-50 p-8 text-center sm:flex-row sm:text-start">
          <IconPin className="h-8 w-8 shrink-0 text-brand-600" />
          <p className="flex-1 text-sm leading-7 text-ink-soft">
            هر پیشنهاد پس از ثبت با یک زنجیرهٔ هش امضا می‌شود؛ هیچ رکوردی —
            حتی توسط مدیران — بدون به‌هم‌ریختن زنجیره قابل تغییر نیست. نتیجهٔ
            بررسی زنجیره پس از هر مسابقه منتشر می‌شود.
          </p>
          <Link href="/how-it-works#fairness" className="btn-dark !py-2.5 text-sm">
            جزئیات فنی
          </Link>
        </div>
      </section>
    </>
  );
}
