"use client";

import { useEffect, useState } from "react";
import { api, type Competition } from "@/lib/api";
import { FALLBACK_COMPETITIONS } from "@/lib/fallback";
import { CompetitionCard } from "@/components/CompetitionCard";

const TABS = [
  { key: "open", label: "باز" },
  { key: "closed", label: "بسته‌شده" },
  { key: "all", label: "همه" },
];

export default function CompetitionsPage() {
  // null یعنی هنوز پاسخ نیامده؛ دادهٔ نمونه فقط جایگزین خطای شبکه می‌شود،
  // نه جایگزین فهرست واقعیِ خالی.
  const [comps, setComps] = useState<Competition[] | null>(null);
  const [tab, setTab] = useState("open");

  useEffect(() => {
    api.competitions(true)
      .then((r) => setComps(r.competitions || []))
      .catch(() => setComps(FALLBACK_COMPETITIONS));
  }, []);

  const shown = (comps || []).filter((c) =>
    tab === "all" ? true : tab === "open" ? c.status === "open" : c.status !== "open",
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="eyebrow">مسابقه‌ها</p>
      <h1 className="h-section mt-2">یک نقطه، یک هفتهٔ رویایی</h1>
      <p className="mt-3 max-w-xl text-ink-muted">
        هر مسابقه یک جایزهٔ مشخص دارد: اقامت در ویلا به‌همراه خودرو. تا پیش از
        زمان بسته‌شدن می‌توانی نقطه‌هایت را ثبت کنی.
      </p>

      <div className="mt-8 inline-flex rounded-full border border-ink/10 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-5 py-2 text-sm font-bold transition ${
              tab === t.key ? "bg-brand-500 text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {comps === null ? (
        <p className="card mt-8 p-10 text-center text-sm text-ink-muted">
          در حال بارگذاری…
        </p>
      ) : shown.length === 0 ? (
        <p className="card mt-8 p-10 text-center text-sm text-ink-muted">
          فعلاً مسابقه‌ای در این دسته نیست.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((c) => <CompetitionCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}
