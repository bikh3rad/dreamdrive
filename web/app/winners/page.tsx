"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type Winner } from "@/lib/api";
import { FALLBACK_WINNERS } from "@/lib/fallback";
import { IconGlobe, IconTrophy } from "@/components/icons";

export default function WinnersPage() {
  // null = هنوز پاسخی نیامده، [] = آمده و خالی بوده. دادهٔ نمونه فقط وقتی
  // نشان داده می‌شود که API اصلاً در دسترس نباشد.
  const [winners, setWinners] = useState<Winner[] | null>(null);

  useEffect(() => {
    api.winners()
      .then((r) => setWinners(r.winners || []))
      .catch(() => setWinners(FALLBACK_WINNERS));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="eyebrow">تالار افتخارات</p>
      <h1 className="h-section mt-2">برندگان</h1>
      <p className="mt-3 max-w-xl text-ink-muted">
        هر برنده با نزدیک‌ترین فاصله به نقطهٔ اعلام‌شدهٔ هیئت داوران انتخاب شده
        است. نقطه و مقدار تصادفی هر مسابقه پس از اعلام نتیجه منتشر می‌شود.
      </p>

      {winners !== null && winners.length === 0 && (
        <p className="mt-10 rounded-card border border-ink/10 bg-canvas-alt px-5 py-6 text-sm text-ink-muted">
          هنوز مسابقه‌ای به نتیجه نرسیده است. پس از نخستین داوری، برندگان همین‌جا فهرست می‌شوند.
        </p>
      )}

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {(winners || []).map((w) => (
          <article key={w.competition_slug} className="card overflow-hidden">
            <div className="aspect-[16/10] bg-canvas-alt">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={w.hero_image} alt={w.prize_title} className="h-full w-full object-cover" />
            </div>
            <div className="p-5">
              <div className="flex items-center gap-2 text-xs text-brand-700">
                <IconTrophy className="h-4 w-4" />
                {new Date(w.decided_at).toLocaleDateString("fa-IR")}
              </div>
              <h2 className="mt-2 text-lg font-black text-ink">{w.winner_name}</h2>
              <p className="mt-1 text-sm text-ink-muted">{w.prize_title}</p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-muted">
                <IconGlobe className="h-4 w-4" />
                {w.country}
              </p>
              <Link
                href={`/competitions/${w.competition_slug}`}
                className="mt-4 inline-block text-xs font-bold text-brand-600 hover:underline"
              >
                مشاهدهٔ جزئیات داوری
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
