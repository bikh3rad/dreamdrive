"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, ApiError, type Competition } from "@/lib/api";
import { commitHash, randomNonce } from "@/lib/commit";
import { useAuth, isJudge } from "@/components/AuthProvider";
import { SpotBoard, type Marker } from "@/components/SpotBoard";
import { IconLock, IconCheck, IconShield } from "@/components/icons";

/** کلید ذخیرهٔ محلی نقطه و nonce تا زمان افشا */
const key = (id: string) => `dd_judge_${id}`;

export default function JudgeConsole() {
  const { user, loading } = useAuth();
  const [comps, setComps] = useState<Competition[]>([]);
  const [sel, setSel] = useState<Competition | null>(null);
  const [mark, setMark] = useState<Marker | null>(null);
  const [saved, setSaved] = useState<{ x: number; y: number; nonce: string; hash: string } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // بدون این شرط، هر کاربر عادی که آدرس را باز کند یک ۴۰۳ بی‌مورد به
    // لاگ سرور می‌زند.
    if (!isJudge(user)) return;
    api.judge.competitions().then((r) => setComps(r.competitions || [])).catch(() => {});
  }, [user]);

  const pick = (c: Competition) => {
    setSel(c); setMark(null); setMsg(null);
    const raw = typeof window !== "undefined" ? localStorage.getItem(key(c.id)) : null;
    setSaved(raw ? JSON.parse(raw) : null);
  };

  const doCommit = async () => {
    if (!sel || !mark) return;
    setBusy(true); setMsg(null);
    try {
      const nonce = randomNonce();
      const hash = await commitHash(mark.x, mark.y, nonce);
      await api.judge.commit(sel.id, hash);
      const rec = { x: mark.x, y: mark.y, nonce, hash };
      localStorage.setItem(key(sel.id), JSON.stringify(rec));
      setSaved(rec);
      setMsg({ kind: "ok", text: "تعهد ثبت شد. نقطه و nonce فقط روی همین مرورگر ذخیره شده است — آن را جای امنی هم یادداشت کن." });
    } catch (e) {
      // ۴۰۹ یعنی سرور از قبل تعهدی برای این داور دارد. چون تعهد غیرقابل
      // تغییر است، این حالت معمولاً وقتی پیش می‌آید که حافظهٔ مرورگر پاک
      // شده باشد؛ در آن صورت nonce از دست رفته و باید دستی بازیابی شود.
      const dup = e instanceof ApiError && e.status === 409;
      setMsg({
        kind: "err",
        text: dup
          ? "برای این مسابقه از قبل تعهدی ثبت شده و تعهد قابل تغییر نیست. اگر نقطه و nonce را در این مرورگر ندارید، برای افشا باید از نسخهٔ یادداشت‌شدهٔ آن استفاده کنید."
          : e instanceof ApiError ? e.message : "ثبت تعهد ناموفق بود.",
      });
    } finally { setBusy(false); }
  };

  const doReveal = async () => {
    if (!sel || !saved) return;
    setBusy(true); setMsg(null);
    try {
      await api.judge.reveal(sel.id, saved.x, saved.y, saved.nonce);
      setMsg({ kind: "ok", text: "رأی افشا شد و با هش ثبت‌شده مطابقت داشت." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "افشا ناموفق بود." });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-24 text-center text-ink-muted">…</div>;

  // کاربر واردنشده و کاربرِ بی‌مجوز دو حالت متفاوت‌اند: اولی فقط باید وارد
  // شود، دومی هرچه کند راه ندارد. یکی گرفتنشان یعنی داوری که هنوز لاگین
  // نکرده پیام «دسترسی نداری» می‌بیند و فکر می‌کند نقشش اشتباه ثبت شده.
  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">کنسول داوری</h1>
        <p className="mt-3 text-sm text-ink-muted">برای ثبت رأی با حساب داوری وارد شو.</p>
        <Link href="/login?next=/judge" className="btn-primary mt-6 inline-flex">
          ورود
        </Link>
      </div>
    );

  if (!isJudge(user))
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">این بخش مخصوص داوران است</h1>
        <p className="mt-3 text-sm text-ink-muted">
          حساب فعلی شما نقش داوری ندارد. اگر باید داور باشید، از مدیر سایت
          بخواهید نقش حسابتان را در «مدیریت کاربران» به «داور» تغییر دهد.
        </p>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">کنسول داوری</p>
      <h1 className="h-section mt-2">ثبت و افشای رأی</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
        نقطه‌ات را انتخاب کن و «ثبت تعهد» را بزن. فقط هش به سرور فرستاده می‌شود،
        نه خود نقطه. پس از بسته‌شدن مسابقه، دکمهٔ «افشا» نقطه و nonce را ارسال
        می‌کند و سرور بررسی می‌کند که با هش قبلی بخواند.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
        <div className="card divide-y divide-ink/[.05]">
          {comps.length === 0 && (
            <p className="p-8 text-center text-xs text-ink-muted">مسابقه‌ای برای داوری نیست.</p>
          )}
          {comps.map((c) => (
            <button
              key={c.id}
              onClick={() => pick(c)}
              className={`block w-full px-4 py-3 text-start hover:bg-canvas-alt/40 ${
                sel?.id === c.id ? "bg-brand-50" : ""
              }`}
            >
              <p className="text-sm font-bold text-ink">{c.prize?.title || c.title}</p>
              <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{c.slug} · {c.status}</p>
            </button>
          ))}
        </div>

        {!sel ? (
          <div className="card flex items-center justify-center p-16 text-sm text-ink-muted">
            یک مسابقه انتخاب کن.
          </div>
        ) : (
          <div className="space-y-5">
            <SpotBoard
              image={sel.board_image}
              markers={mark ? [mark] : saved ? [{ x: saved.x, y: saved.y }] : []}
              onAdd={(m) => setMark(m)}
              onRemove={() => setMark(null)}
              readOnly={!!saved}
            />

            {saved && (
              <div className="card p-5">
                <p className="flex items-center gap-2 text-sm font-black text-ink">
                  <IconLock className="h-4 w-4 text-brand-600" />
                  تعهد ثبت‌شده
                </p>
                <dl className="ltr-nums mt-3 space-y-1.5 text-xs text-ink-soft">
                  <div className="flex justify-between"><dt>x</dt><dd className="font-bold">{saved.x.toFixed(6)}</dd></div>
                  <div className="flex justify-between"><dt>y</dt><dd className="font-bold">{saved.y.toFixed(6)}</dd></div>
                  <div className="flex justify-between gap-4"><dt>nonce</dt><dd className="truncate font-bold">{saved.nonce}</dd></div>
                  <div className="flex justify-between gap-4"><dt>hash</dt><dd className="truncate font-bold">{saved.hash}</dd></div>
                </dl>
              </div>
            )}

            {msg && (
              <p className={`rounded-xl px-4 py-3 text-xs leading-6 ${
                msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
              }`}>{msg.text}</p>
            )}

            <div className="flex flex-wrap gap-3">
              {/* همان شرطی که store دارد: تعهد تا پیش از بسته‌شدن مجاز است،
                  یعنی draft و open. */}
              <button
                onClick={doCommit}
                disabled={!mark || !!saved || busy || (sel.status !== "open" && sel.status !== "draft")}
                className="btn-primary !py-2.5 text-sm"
              >
                <IconLock className="h-4 w-4" />
                ثبت تعهد
              </button>
              <button onClick={doReveal} disabled={!saved || busy || sel.status === "open"} className="btn-dark !py-2.5 text-sm">
                <IconCheck className="h-4 w-4" />
                افشای رأی
              </button>
            </div>

            <p className="flex items-start gap-2 text-xs leading-6 text-ink-muted">
              <IconShield className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
              تعهد فقط یک‌بار برای هر مسابقه پذیرفته می‌شود و قابل تغییر نیست.
              اگر nonce را از دست بدهی، رأیت قابل افشا نخواهد بود.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
