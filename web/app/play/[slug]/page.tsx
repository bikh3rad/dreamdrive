"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  api, faNum, money, timeLeft, ApiError,
  type Competition,
} from "@/lib/api";
import { FALLBACK_COMPETITIONS } from "@/lib/fallback";
import { SpotBoard, type Marker } from "@/components/SpotBoard";
import { useAuth } from "@/components/AuthProvider";
import { useCart } from "@/components/CartProvider";
import { IconGift, IconInfo, IconShield, IconTicket } from "@/components/icons";

export default function PlayPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { user } = useAuth();
  const { add, picks } = useCart();

  const [comp, setComp] = useState<Competition | null>(null);
  const [marks, setMarks] = useState<Marker[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [missing, setMissing] = useState(false);
  // جایزهٔ انتخابی. عمداً پیش‌فرض ندارد تا انتخاب یک تصمیم آگاهانه باشد؛
  // با پیش‌فرضِ گران‌ترین، کاربر ممکن بود بدون توجه بلیط گران بخرد.
  const [levelId, setLevelId] = useState<string>("");

  useEffect(() => {
    api.competition(params.slug)
      .then(setComp)
      .catch((e) => {
        // ۴۰۴ یعنی این مسابقه واقعاً نیست (حذف یا slug عوض شده). نشان دادن
        // یک مسابقهٔ نمونه به‌جایش خطرناک است: دکمه‌های خرید روی slugی کار
        // می‌کنند که وجود ندارد.
        if (e instanceof ApiError && e.status === 404) {
          setMissing(true);
          return;
        }
        setComp(FALLBACK_COMPETITIONS.find((c) => c.slug === params.slug) || null);
      });
  }, [params.slug]);

  const levels = useMemo(
    () => (comp?.prizes || []).filter((l) => l.is_active),
    [comp],
  );
  const level = useMemo(
    () => levels.find((l) => l.id === levelId) || null,
    [levels, levelId],
  );

  // اگر فقط یک جایزه هست، انتخابی در کار نیست و نپرسیدن بهتر است.
  useEffect(() => {
    if (levels.length === 1) setLevelId(levels[0].id);
  }, [levels]);

  const total = useMemo(
    () => (level ? marks.length * level.ticket_price_cents : 0),
    [marks.length, level],
  );

  if (missing) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-24 text-center">
        <p className="text-ink-muted">این مسابقه دیگر در دسترس نیست.</p>
        <Link href="/competitions" className="btn-primary mt-6 inline-flex">
          دیدن مسابقه‌های باز
        </Link>
      </div>
    );
  }

  if (!comp) {
    return <div className="mx-auto max-w-7xl px-4 py-24 text-center text-ink-muted">در حال بارگذاری…</div>;
  }

  const closed = comp.status !== "open";

  // ظرفیت دوره پر شده ولی هنوز بسته نشده. این حالت واقعی است و گذرا نیست:
  // بستنِ خودکار به ثبت تعهد داوران گره خورده، پس دوره می‌تواند مدتی «باز
  // ولی پر» بماند. بدون این شرط، دکمه‌ها فعال می‌ماندند و هر خرید با خطای
  // ۴۰۹ برمی‌گشت — یعنی کاربر نقطه انتخاب می‌کرد، پرداخت را شروع می‌کرد و
  // بعد می‌فهمید جایی نبوده.
  // reserved_count و نه entry_count: گیتِ فروش سرور سفارش pending را هم
  // می‌شمارد. با چند سبدِ پرداخت‌نشده روی سقف، entry_count هنوز کمتر از هدف
  // است ولی Checkout با ErrTargetReached رد می‌کند — یعنی دقیقاً همان ۴۰۹ای
  // که این شرط قرار بود جلویش را بگیرد. ?? به entry_count برمی‌گردد چون
  // فهرست‌ها reserved_count نمی‌فرستند.
  const full =
    !closed &&
    comp.entry_target > 0 &&
    (comp.reserved_count ?? comp.entry_count ?? 0) >= comp.entry_target;
  const locked = closed || full;

  const addToCart = () => {
    if (!user) return router.push(`/login?next=/play/${comp.slug}`);
    if (!level) {
      return setMsg({ kind: "err", text: "اول جایزه‌ای که می‌خواهی ببری را انتخاب کن." });
    }
    marks.forEach((m) =>
      add({
        competitionSlug: comp.slug,
        competitionTitle: comp.title,
        competitionPrizeId: level.id,
        prizeTitle: level.prize?.title || comp.title,
        x: m.x, y: m.y,
        priceCents: level.ticket_price_cents,
        currency: comp.currency,
      }),
    );
    setMarks([]);
    router.push("/cart");
  };

  const freeEntry = async () => {
    if (!user) return router.push(`/login?next=/play/${comp.slug}`);
    // ورود رایگان هم جایزه می‌خواهد — همان انتخابی که خریدار پولی دارد.
    if (!level) {
      return setMsg({ kind: "err", text: "اول جایزه‌ای که می‌خواهی ببری را انتخاب کن." });
    }
    if (marks.length !== 1) {
      return setMsg({ kind: "err", text: "برای ورود رایگان دقیقاً یک نقطه انتخاب کن." });
    }
    setBusy(true); setMsg(null);
    try {
      await api.freeEntry(comp.slug, level.id, marks[0].x, marks[0].y);
      setMarks([]);
      setMsg({ kind: "ok", text: "ورود رایگان ثبت شد. نتیجه پس از رأی داوران اعلام می‌شود." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "ثبت ناموفق بود." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <nav className="mb-6 text-xs text-ink-muted">
        <Link href="/" className="hover:text-ink">خانه</Link>
        <span className="mx-2">/</span>
        <Link href="/competitions" className="hover:text-ink">مسابقه‌ها</Link>
        <span className="mx-2">/</span>
        <span className="text-ink">{comp.prize?.title || comp.title}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* ---- تخته ---- */}
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black text-ink sm:text-3xl">
                {comp.prize?.title || comp.title}
              </h1>
              <p className="mt-1 text-sm text-ink-muted">{comp.prize?.subtitle}</p>
            </div>
            <span className={`chip ${closed ? "bg-ink text-white" : "bg-brand-100 text-brand-700"}`}>
              {closed ? "بسته شده" : `${timeLeft(comp.closes_at)} تا پایان`}
            </span>
          </div>

          <SpotBoard
            image={comp.board_image}
            markers={marks}
            onAdd={(m) => setMarks((p) => [...p, m])}
            onRemove={(i) => setMarks((p) => p.filter((_, j) => j !== i))}
            readOnly={locked}
          />

          {full && (
            <div className="card mt-5 flex items-center gap-3 bg-canvas-alt p-5 text-sm text-ink-soft">
              <IconInfo className="h-5 w-5 shrink-0 text-ink-muted" />
              ظرفیت این دوره تکمیل شده و پیشنهاد تازه‌ای پذیرفته نمی‌شود؛
              نتیجه پس از رأی داوران اعلام می‌شود.
            </div>
          )}

          {closed && (
            <div className="card mt-5 flex items-center gap-3 bg-canvas-alt p-5 text-sm text-ink-soft">
              <IconInfo className="h-5 w-5 shrink-0 text-ink-muted" />
              این مسابقه بسته شده است.{" "}
              <Link href={`/competitions/${comp.slug}`} className="font-bold text-brand-600 hover:underline">
                مشاهدهٔ نتیجه و رأی داوران
              </Link>
            </div>
          )}
        </div>

        {/* ---- کنارهٔ خرید ---- */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="card p-6">
            <h3 className="text-sm font-black text-ink">کدام جایزه را می‌خواهی ببری؟</h3>
            <p className="mt-1 text-xs leading-6 text-ink-muted">
              همه در یک رقابت‌اند و شانس همه برابر است. انتخاب تو فقط تعیین
              می‌کند اگر برندهٔ این دوره شدی چه چیزی تحویل می‌گیری — و قیمت
              هر پیشنهاد چقدر است.
            </p>

            <div className="mt-4 space-y-2">
              {levels.map((l) => {
                const on = l.id === levelId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLevelId(l.id)}
                    disabled={locked}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-start transition ${
                      on
                        ? "border-brand-500 bg-brand-50"
                        : "border-ink/[.10] hover:border-ink/25"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-ink">
                        {l.prize?.title || "جایزه"}
                      </span>
                      {l.prize?.subtitle && (
                        <span className="block truncate text-xs text-ink-muted">
                          {l.prize.subtitle}
                        </span>
                      )}
                    </span>
                    <span className="ltr-nums shrink-0 text-sm font-black text-brand-600">
                      {money(l.ticket_price_cents, comp.currency)}
                    </span>
                  </button>
                );
              })}
              {levels.length === 0 && (
                <p className="rounded-xl bg-canvas-alt px-3 py-2 text-xs text-ink-muted">
                  هیچ جایزه‌ای برای این مسابقه در دسترس نیست.
                </p>
              )}
            </div>

            <div className="my-5 h-px bg-ink/[.07]" />

            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-ink-soft">
                <IconTicket className="h-4 w-4" />
                نقطه‌های انتخاب‌شده
              </span>
              <span className="ltr-nums font-black">{faNum(marks.length)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-ink-soft">مجموع</span>
              <span className="ltr-nums font-black text-brand-600">
                {money(total, comp.currency)}
              </span>
            </div>

            <button
              onClick={addToCart}
              disabled={locked || marks.length === 0 || busy || !level}
              className="btn-primary mt-5 w-full"
            >
              {full ? "ظرفیت تکمیل است" : "افزودن به سبد"}
            </button>

            <button
              onClick={freeEntry}
              disabled={locked || busy || !level}
              className="btn-ghost mt-2 w-full !py-2.5 text-sm"
            >
              <IconGift className="h-4 w-4" />
              ورود رایگان (یک نقطه)
            </button>

            {msg && (
              <p className={`mt-3 rounded-xl px-3 py-2 text-xs leading-6 ${
                msg.kind === "ok" ? "bg-brand-50 text-brand-700" : "bg-red-50 text-red-700"
              }`}>
                {msg.text}
              </p>
            )}

            {picks.length > 0 && (
              <p className="mt-3 text-center text-xs text-ink-muted">
                <span className="ltr-nums font-bold">{faNum(picks.length)}</span> پیشنهاد در سبد ·{" "}
                <Link href="/cart" className="font-bold text-brand-600 hover:underline">مشاهدهٔ سبد</Link>
              </p>
            )}
          </div>

          <div className="card p-6">
            <h3 className="flex items-center gap-2 text-sm font-black text-ink">
              <IconShield className="h-4 w-4 text-brand-600" />
              نقطه از قبل قفل شده است
            </h3>
            <p className="mt-2 text-xs leading-7 text-ink-muted">
              هیئت داوران پیش از بسته‌شدن این مسابقه، هش نقطهٔ خود را ثبت کرده‌اند.
              نه ما و نه هیچ کارمندی نمی‌تواند پاسخ را ببیند یا تغییر دهد. پس از
              بسته‌شدن، نقطه و مقدار تصادفی آن منتشر می‌شود و هرکس می‌تواند هش را
              خودش بررسی کند.
            </p>
            <Link href="/how-it-works#fairness" className="mt-3 inline-block text-xs font-bold text-brand-600 hover:underline">
              روش بررسی
            </Link>
          </div>

          <div className="card p-6">
            <h3 className="text-sm font-black text-ink">قوانین کوتاه</h3>
            <ul className="mt-3 space-y-2 text-xs leading-6 text-ink-muted">
              <li>حداکثر <span className="ltr-nums font-bold">{faNum(comp.max_entries_user)}</span> پیشنهاد برای هر کاربر</li>
              {/* !closed لازم است: جملهٔ آینده («بسته می‌شود») کنار نشان
                  «بسته شده» تناقض می‌سازد. */}
              {comp.entry_target > 0 && !closed && (
                <li>
                  این دوره با{" "}
                  <span className="ltr-nums font-bold">
                    {faNum(comp.entry_target.toLocaleString("en-US"))}
                  </span>{" "}
                  حدس — یا با رسیدن به زمان پایان، هر کدام زودتر — بسته و آمادهٔ
                  داوری می‌شود. تاکنون{" "}
                  <span className="ltr-nums font-bold">
                    {faNum((comp.entry_count ?? 0).toLocaleString("en-US"))}
                  </span>{" "}
                  حدس ثبت شده است.
                </li>
              )}
              {levels.length > 1 && (
                <li className="font-bold text-ink-soft">
                  در هر دوره فقط <span className="font-black">یک برنده</span> و
                  در نتیجه فقط یک جایزه اهدا می‌شود؛ جوایز دیگر همان دوره برنده
                  ندارند.
                </li>
              )}
              <li>یک ورود رایگان برای هر کاربر در هر مسابقه — با همان حق انتخاب جایزه</li>
              <li>در صورت تساوی، پیشنهادی که زودتر ثبت شده برنده است</li>
              <li>کارکنان و پیمانکاران مجاز به شرکت نیستند</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
