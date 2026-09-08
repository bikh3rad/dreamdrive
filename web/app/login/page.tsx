"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { Logo, IconLock, IconMail, IconShield } from "@/components/icons";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr("");
    try {
      await login(email, password);
      router.push(next);
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "ورود ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[70vh] max-w-5xl items-center gap-12 px-4 py-12 sm:px-6 lg:grid-cols-2">
      <div className="card mx-auto w-full max-w-md p-8">
        <Logo className="h-11 w-11" />
        <h1 className="mt-5 text-2xl font-black text-ink">خوش برگشتی</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          برای ثبت پیشنهاد و دیدن نتیجه‌ها وارد شو.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label" htmlFor="email">ایمیل</label>
            <div className="relative">
              <IconMail className="absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="email" type="email" required dir="ltr"
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="field pe-10 text-start" placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="password">رمز عبور</label>
            <div className="relative">
              <IconLock className="absolute end-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <input
                id="password" type="password" required dir="ltr"
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="field pe-10 text-start" placeholder="••••••••"
              />
            </div>
          </div>

          {err && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
          )}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "در حال ورود…" : "ورود"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          حساب نداری؟{" "}
          <Link href="/register" className="font-bold text-brand-600 hover:underline">ثبت‌نام کن</Link>
        </p>
      </div>

      <div className="hidden lg:block">
        <p className="eyebrow">چرا حساب لازم است</p>
        <h2 className="mt-2 text-3xl font-black leading-tight text-ink">
          تا پیشنهادهایت قابل ردیابی و قابل اثبات بمانند
        </h2>
        <ul className="mt-7 space-y-5">
          {[
            ["هر پیشنهاد امضا می‌شود", "زنجیرهٔ هش تضمین می‌کند هیچ‌کس نمی‌تواند نقطهٔ ثبت‌شده‌ات را بعداً تغییر دهد."],
            ["ورود رایگان بدون پرداخت", "یک ورود رایگان در هر مسابقه، با همان شانس برنده‌شدن."],
            ["اعتبار نزدیک‌ترین حدس", "اگر خیلی نزدیک شدی ولی نبردی، بخشی از بلیط به کیف پولت برمی‌گردد."],
          ].map(([t, d]) => (
            <li key={t} className="flex gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
                <IconShield className="h-5 w-5" />
              </span>
              <div>
                <p className="font-black text-ink">{t}</p>
                <p className="mt-1 text-sm leading-7 text-ink-muted">{d}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-24 text-center text-ink-muted">…</div>}>
      <LoginForm />
    </Suspense>
  );
}
