"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import { Logo } from "@/components/icons";

const COUNTRIES = [
  "IE", "PT", "ES", "IT", "FR", "DE", "NL", "BE", "AT", "DK", "SE", "FI", "PL", "CZ", "GR",
];
const NAMES: Record<string, string> = {
  IE: "ایرلند", PT: "پرتغال", ES: "اسپانیا", IT: "ایتالیا", FR: "فرانسه",
  DE: "آلمان", NL: "هلند", BE: "بلژیک", AT: "اتریش", DK: "دانمارک",
  SE: "سوئد", FI: "فنلاند", PL: "لهستان", CZ: "چک", GR: "یونان",
};

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({ full_name: "", email: "", password: "", country: "IE" });
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return setErr("برای ادامه باید قوانین را بپذیری.");
    setBusy(true); setErr("");
    try {
      await register(form);
      router.push("/");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : "ثبت‌نام ناموفق بود.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
      <div className="card p-8">
        <Logo className="h-11 w-11" />
        <h1 className="mt-5 text-2xl font-black text-ink">ساخت حساب</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          کمتر از یک دقیقه طول می‌کشد. برای شرکت باید ۱۸ سال یا بیشتر داشته باشی.
        </p>

        <form onSubmit={submit} className="mt-7 space-y-4">
          <div>
            <label className="label" htmlFor="name">نام و نام خانوادگی</label>
            <input id="name" required value={form.full_name} onChange={set("full_name")} className="field" />
          </div>
          <div>
            <label className="label" htmlFor="email">ایمیل</label>
            <input id="email" type="email" dir="ltr" required value={form.email} onChange={set("email")} className="field text-start" />
          </div>
          <div>
            <label className="label" htmlFor="pw">رمز عبور</label>
            <input id="pw" type="password" dir="ltr" required minLength={8} value={form.password} onChange={set("password")} className="field text-start" />
            <p className="mt-1.5 text-xs text-ink-muted">حداقل ۸ نویسه.</p>
          </div>
          <div>
            <label className="label" htmlFor="country">کشور محل اقامت</label>
            <select id="country" value={form.country} onChange={set("country")} className="field">
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{NAMES[c]}</option>
              ))}
            </select>
          </div>

          <label className="flex items-start gap-2.5 text-xs leading-6 text-ink-muted">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#F0A828]" />
            <span>
              <Link href="/legal/terms" className="font-bold text-brand-600 hover:underline">شرایط استفاده</Link> و{" "}
              <Link href="/legal/rules" className="font-bold text-brand-600 hover:underline">قوانین مسابقه</Link>{" "}
              را خوانده‌ام و می‌پذیرم. تأیید می‌کنم ۱۸ سال یا بیشتر دارم.
            </span>
          </label>

          {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? "در حال ساخت…" : "ساخت حساب"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-muted">
          قبلاً حساب ساخته‌ای؟{" "}
          <Link href="/login" className="font-bold text-brand-600 hover:underline">ورود</Link>
        </p>
      </div>
    </div>
  );
}
