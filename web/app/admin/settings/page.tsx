"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHead } from "@/components/admin/ui";
import { Logo } from "@/components/icons";
import { ImagePicker } from "@/components/admin/ImagePicker";

type S = Record<string, any>;

const DEFAULTS: S = {
  site_name: "به سوی رویا",
  tagline: "یک نقطه فاصله‌ات است تا هفتهٔ رویایی",
  support_email: "support@besooyeroya.com",
  free_entry_address: "",
  color_brand: "#F0A828",
  color_ink: "#1E2A47",
  color_canvas: "#FAF7F2",
  hero_image: "",
  near_miss_threshold: 0.05,
  near_miss_max_percent: 100,
  packs: [
    { entries: 1, price_cents: 300 },
    { entries: 5, price_cents: 1200 },
    { entries: 20, price_cents: 4000 },
  ],
  min_age: 18,
  maintenance: false,
};

const TABS = [
  { k: "brand", label: "هویت و ظاهر" },
  { k: "commerce", label: "قیمت‌گذاری" },
  { k: "legal", label: "قوانین و ورود رایگان" },
  { k: "system", label: "سیستم" },
];

export default function SettingsPage() {
  const [s, setS] = useState<S>(DEFAULTS);
  const [tab, setTab] = useState("brand");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.settings().then((r) => setS({ ...DEFAULTS, ...r })).catch(() => {});
  }, []);

  const set = (k: string, v: any) => setS((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      await api.admin.saveSettings(s);
      setMsg({ kind: "ok", text: "تنظیمات ذخیره شد." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "ذخیره ناموفق بود." });
    } finally { setBusy(false); }
  };

  const packs: { entries: number; price_cents: number }[] = s.packs || [];
  const setPack = (i: number, k: string, v: number) =>
    set("packs", packs.map((p, j) => (j === i ? { ...p, [k]: v } : p)));

  return (
    <>
      <PageHead
        title="تنظیمات و ظاهر سایت"
        subtitle="نام، رنگ‌ها، بسته‌های قیمت، نشانی ورود رایگان و قواعد پاداش. تغییرات بلافاصله روی سایت عمومی اعمال می‌شود."
        action={
          <button onClick={save} disabled={busy} className="btn-primary !py-2.5 text-sm">
            {busy ? "در حال ذخیره…" : "ذخیرهٔ تغییرات"}
          </button>
        }
      />

      {msg && (
        <p className={`mb-5 rounded-xl px-4 py-3 text-sm ${
          msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
        }`}>{msg.text}</p>
      )}

      <div className="mb-6 flex gap-1 overflow-x-auto rounded-full border border-ink/10 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.k}
            onClick={() => setTab(t.k)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
              tab === t.k ? "bg-brand-500 text-ink" : "text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="card p-6">
          {tab === "brand" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label">نام سایت</label>
                <input className="field" value={s.site_name} onChange={(e) => set("site_name", e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">شعار</label>
                <input className="field" value={s.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </div>
              {[
                ["color_brand", "رنگ اصلی (کهربایی)"],
                ["color_ink", "رنگ متن و دکمهٔ تیره"],
                ["color_canvas", "رنگ پس‌زمینه"],
              ].map(([k, l]) => (
                <div key={k}>
                  <label className="label">{l}</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color" value={s[k]} onChange={(e) => set(k, e.target.value)}
                      className="h-11 w-14 cursor-pointer rounded-xl border border-ink/15 bg-white p-1"
                    />
                    <input
                      className="field text-start" dir="ltr" value={s[k]}
                      onChange={(e) => set(k, e.target.value)}
                    />
                  </div>
                </div>
              ))}
              <div className="sm:col-span-2">
                <ImagePicker
                  label="تصویر بنر صفحهٔ اصلی"
                  folder="brand"
                  value={s.hero_image}
                  onChange={(url) => set("hero_image", url)}
                />
              </div>
            </div>
          )}

          {tab === "commerce" && (
            <div className="space-y-6">
              <div>
                <p className="label">بسته‌های پیشنهاد</p>
                <div className="space-y-3">
                  {packs.map((p, i) => (
                    <div key={i} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                      <div>
                        <label className="mb-1 block text-xs text-ink-muted">تعداد پیشنهاد</label>
                        <input
                          className="field text-start" dir="ltr" type="number" value={p.entries}
                          onChange={(e) => setPack(i, "entries", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs text-ink-muted">قیمت (سنت)</label>
                        <input
                          className="field text-start" dir="ltr" type="number" value={p.price_cents}
                          onChange={(e) => setPack(i, "price_cents", Number(e.target.value))}
                        />
                      </div>
                      <button
                        onClick={() => set("packs", packs.filter((_, j) => j !== i))}
                        className="self-end rounded-xl px-3 py-3 text-xs font-bold text-red-600 hover:bg-red-50"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => set("packs", [...packs, { entries: 1, price_cents: 300 }])}
                  className="btn-ghost mt-3 !py-2 !px-4 text-xs"
                >
                  افزودن بسته
                </button>
              </div>

              <div className="border-t border-ink/[.07] pt-6">
                <p className="label">پاداش نزدیک‌ترین حدس</p>
                <p className="mb-4 text-xs leading-6 text-ink-muted">
                  اگر فاصلهٔ پیشنهاد کاربر از نقطهٔ داوران کمتر از آستانه باشد،
                  بخشی از بهای بلیط به‌صورت اعتبار برگردانده می‌شود — به‌طور
                  نسبی و حداکثر تا درصد تعیین‌شده.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label">آستانهٔ فاصله (۰ تا ۱)</label>
                    <input
                      className="field text-start" dir="ltr" type="number" step="0.01"
                      value={s.near_miss_threshold}
                      onChange={(e) => set("near_miss_threshold", Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="label">سقف بازگشت (درصد بهای بلیط)</label>
                    <input
                      className="field text-start" dir="ltr" type="number"
                      value={s.near_miss_max_percent}
                      onChange={(e) => set("near_miss_max_percent", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "legal" && (
            <div className="space-y-4">
              <div>
                <label className="label">نشانی پستی ورود رایگان</label>
                <textarea
                  className="field min-h-[7rem]" value={s.free_entry_address}
                  onChange={(e) => set("free_entry_address", e.target.value)}
                />
                <p className="mt-1.5 text-xs text-ink-muted">
                  در صفحهٔ «ورود رایگان» نمایش داده می‌شود. وجود این مسیر برای
                  اینکه مسابقه به‌عنوان قرعه‌کشی طبقه‌بندی نشود ضروری است.
                </p>
              </div>
              <div>
                <label className="label">حداقل سن</label>
                <input
                  className="field max-w-[8rem] text-start" dir="ltr" type="number"
                  value={s.min_age} onChange={(e) => set("min_age", Number(e.target.value))}
                />
              </div>
              <div>
                <label className="label">ایمیل پشتیبانی</label>
                <input
                  className="field text-start" dir="ltr" value={s.support_email}
                  onChange={(e) => set("support_email", e.target.value)}
                />
              </div>
            </div>
          )}

          {tab === "system" && (
            <div className="space-y-5">
              <label className="flex items-start gap-3 text-sm text-ink-soft">
                <input
                  type="checkbox" className="mt-1 h-4 w-4 accent-[#F0A828]"
                  checked={!!s.maintenance} onChange={(e) => set("maintenance", e.target.checked)}
                />
                <span>
                  حالت تعمیر
                  <span className="mt-0.5 block text-xs text-ink-muted">
                    سایت عمومی پیام تعمیر نشان می‌دهد؛ پنل مدیریت باز می‌ماند.
                    ثبت پیشنهاد جدید متوقف می‌شود ولی مسابقه‌های باز بسته نمی‌شوند.
                  </span>
                </span>
              </label>

              <div className="rounded-xl bg-canvas-alt p-4 text-xs leading-6 text-ink-soft">
                <p className="font-black text-ink">تنظیمات غیرقابل تغییر از این صفحه</p>
                <p className="mt-2">
                  کلید امضای توکن، رشتهٔ اتصال پایگاه داده و کلیدهای درگاه پرداخت
                  فقط از متغیرهای محیطی خوانده می‌شوند و عمداً در پنل قابل ویرایش
                  نیستند تا دسترسی مدیریتی نتواند به کلیدها برسد.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* پیش‌نمایش زنده */}
        <aside className="card h-fit overflow-hidden xl:sticky xl:top-6">
          <p className="border-b border-ink/[.07] px-5 py-3 text-xs font-bold text-ink-muted">
            پیش‌نمایش
          </p>
          <div className="p-5" style={{ background: s.color_canvas }}>
            <div className="flex items-center gap-2.5">
              <Logo className="h-8 w-8" />
              <span className="text-sm font-black" style={{ color: s.color_ink }}>
                {s.site_name}
              </span>
            </div>
            <p className="mt-4 text-lg font-black leading-snug" style={{ color: s.color_ink }}>
              {s.tagline}
            </p>
            <button
              className="mt-4 rounded-full px-5 py-2.5 text-sm font-bold"
              style={{ background: s.color_brand, color: s.color_ink }}
            >
              همین حالا بازی کن
            </button>
            <div className="mt-4 flex gap-2">
              {packs.slice(0, 3).map((p, i) => (
                <div
                  key={i}
                  className="ltr-nums flex-1 rounded-xl bg-white p-3 text-center text-[11px]"
                  style={{ color: s.color_ink }}
                >
                  <p className="font-black">{(p.price_cents / 100).toFixed(2)}</p>
                  <p className="mt-0.5 opacity-60">{p.entries}×</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
