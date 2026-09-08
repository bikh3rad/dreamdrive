"use client";

import Link from "next/link";
import { IconGift, IconMail, IconCheck } from "@/components/icons";

export default function FreeEntryPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <span className="chip bg-brand-100 text-brand-700">
        <IconGift className="h-4 w-4" />
        بدون هیچ پرداختی
      </span>
      <h1 className="h-section mt-4">ورود رایگان</h1>
      <p className="mt-3 text-lg leading-8 text-ink-soft">
        شرکت در مسابقه هیچ‌گاه مشروط به پرداخت نیست. ورود رایگان دقیقاً همان
        شانس ورود پرداختی را دارد و در همان مجموعهٔ پیشنهادها داوری می‌شود.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        <div className="card p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
            <IconGift className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-black text-ink">راه اول: آنلاین</h2>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            وارد حسابت شو، یک مسابقهٔ باز را انتخاب کن، یک نقطه روی تصویر بگذار و
            دکمهٔ «ورود رایگان» را بزن. هر کاربر در هر مسابقه یک ورود رایگان دارد.
          </p>
          <Link href="/play" className="btn-primary mt-5 !py-2.5 text-sm">
            ثبت ورود رایگان
          </Link>
        </div>

        <div className="card p-7">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-canvas-alt text-ink-soft">
            <IconMail className="h-5 w-5" />
          </span>
          <h2 className="mt-4 font-black text-ink">راه دوم: پستی</h2>
          <p className="mt-2 text-sm leading-7 text-ink-muted">
            یک کارت‌پستال دست‌نویس شامل نام کامل، ایمیل حساب، شناسهٔ مسابقه و
            مختصات نقطهٔ پیشنهادی‌ات (به‌صورت x و y بین ۰ تا ۱) به نشانی زیر
            بفرست. باید پیش از زمان بسته‌شدن مسابقه به دست ما برسد.
          </p>
          <address className="mt-4 rounded-xl bg-canvas-alt p-4 text-xs not-italic leading-7 text-ink-soft">
            نشانی پستی در تنظیمات سایت توسط مدیر تعیین می‌شود
            <br />
            (بخش «تنظیمات و ظاهر سایت» → نشانی ورود رایگان)
          </address>
        </div>
      </div>

      <h2 className="mt-12 text-lg font-black text-ink">شرایط</h2>
      <ul className="mt-4 space-y-3">
        {[
          "حداکثر یک ورود رایگان برای هر کاربر در هر مسابقه، از هر دو راه.",
          "ورودهای تکراری یا گروهی حذف می‌شوند.",
          "شرکت‌کننده باید ۱۸ سال یا بیشتر و ساکن یکی از کشورهای مجاز باشد.",
          "ورود رایگان در تعیین برنده هیچ تفاوتی با ورود پرداختی ندارد.",
        ].map((t) => (
          <li key={t} className="flex items-start gap-3 text-sm leading-7 text-ink-muted">
            <IconCheck className="mt-1.5 h-4 w-4 shrink-0 text-brand-600" />
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}
