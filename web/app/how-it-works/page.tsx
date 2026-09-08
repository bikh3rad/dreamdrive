"use client";

import Link from "next/link";
import { IconGift, IconScale, IconShield, IconTarget, IconUsers } from "@/components/icons";

const STEPS = [
  { t: "تصویر را باز کن", d: "یک قاب واقعی از یک بازی که توپ از آن حذف شده است. تصویر با کیفیت بالا ارائه می‌شود و می‌توانی تا چهار برابر بزرگ‌نمایی کنی." },
  { t: "نقطه را تحلیل کن", d: "جهت نگاه بازیکنان، زاویهٔ بدن دروازه‌بان، سایه‌ها و مسیر حرکت — همهٔ این‌ها سرنخ‌های مهارتی هستند. این تصمیم مهارتی است، نه تصادفی." },
  { t: "پیشنهادت را ثبت کن", d: "هر نقطه یک پیشنهاد است. می‌توانی چند نقطه ثبت کنی تا دقتت را بالا ببری، یا از مسیر ورود رایگان استفاده کنی." },
  { t: "داوران رأی می‌دهند", d: "هیئت داوران مستقل، پیش از بسته‌شدن مسابقه، نقطهٔ خود را انتخاب و هش آن را ثبت می‌کنند. پس از بسته‌شدن، نقطه‌ها آشکار و میانگین گرفته می‌شود." },
  { t: "برنده مشخص می‌شود", d: "نزدیک‌ترین پیشنهاد به نقطهٔ میانگین داوران برنده است. در صورت تساوی، پیشنهادی که زودتر ثبت شده مقدم است." },
];

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="eyebrow">راهنما</p>
      <h1 className="h-section mt-2">چطور کار می‌کند</h1>
      <p className="mt-3 text-lg leading-8 text-ink-soft">
        این یک قرعه‌کشی نیست. برنده بر اساس دقت تشخیص انتخاب می‌شود و کل فرایند
        به‌گونه‌ای طراحی شده که حتی ما هم نتوانیم نتیجه را دستکاری کنیم.
      </p>

      <ol className="mt-10 space-y-4">
        {STEPS.map((s, i) => (
          <li key={s.t} className="card flex gap-5 p-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-black text-brand-700">
              {"۱۲۳۴۵"[i]}
            </span>
            <div>
              <h2 className="font-black text-ink">{s.t}</h2>
              <p className="mt-2 text-sm leading-7 text-ink-muted">{s.d}</p>
            </div>
          </li>
        ))}
      </ol>

      {/* ---- انصاف ---- */}
      <section id="fairness" className="mt-16 scroll-mt-24">
        <p className="eyebrow">شفافیت</p>
        <h2 className="h-section mt-2">چرا نتیجه قابل دستکاری نیست</h2>

        <div className="mt-8 space-y-4">
          <Block icon={IconShield} title="تعهد و افشا (commit–reveal)">
            هر داور نقطهٔ خود را به‌همراه یک مقدار تصادفی درون یک هش
            <code className="ltr-nums mx-1 rounded bg-canvas-alt px-1.5 py-0.5 text-xs">SHA-256</code>
            قفل می‌کند و همان هش پیش از بسته‌شدن مسابقه ثبت می‌شود. پس از
            بسته‌شدن، نقطه و مقدار تصادفی منتشر می‌شود و هر کسی می‌تواند هش را
            دوباره محاسبه کند. اگر داوری بعداً نظرش را عوض کند، هش نمی‌خواند و
            رأیش باطل است.
          </Block>

          <Block icon={IconScale} title="زنجیرهٔ هش پیشنهادها">
            هر پیشنهاد با هش پیشنهاد قبلی امضا می‌شود. حذف، تغییر یا جاگذاری یک
            رکورد، کل زنجیره را می‌شکند. نتیجهٔ بررسی زنجیره پس از هر مسابقه
            منتشر می‌شود.
          </Block>

          <Block icon={IconUsers} title="جداسازی نقش‌ها و ممنوعیت داخلی">
            هیچ نقش مدیریتی به مختصات پیشنهادها در زمان باز بودن مسابقه دسترسی
            ندارد. کارکنان، پیمانکاران و بستگان درجه‌یک آن‌ها مجاز به شرکت
            نیستند و حساب‌هایشان به‌صورت سیستمی علامت‌گذاری شده است. هر اقدام
            مدیریتی در گزارش ممیزی ثبت می‌شود.
          </Block>

          <Block icon={IconGift} title="مسیر ورود رایگان">
            یک ورود رایگان برای هر کاربر در هر مسابقه در دسترس است و شانس آن
            دقیقاً برابر با ورود پرداختی است.{" "}
            <Link href="/free-entry" className="font-bold text-brand-600 hover:underline">
              راهنمای ورود رایگان
            </Link>
          </Block>
        </div>
      </section>

      <div className="card mt-12 flex flex-col items-center gap-4 bg-brand-50 p-8 text-center">
        <IconTarget className="h-9 w-9 text-brand-600" />
        <h2 className="text-xl font-black text-ink">آماده‌ای امتحان کنی؟</h2>
        <p className="max-w-md text-sm leading-7 text-ink-muted">
          اولین نقطه‌ات را رایگان ثبت کن و ببین چقدر به رأی داوران نزدیک می‌شوی.
        </p>
        <Link href="/play" className="btn-primary">شروع بازی</Link>
      </div>
    </div>
  );
}

function Block({
  icon: Icon, title, children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card flex gap-5 p-6">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h3 className="font-black text-ink">{title}</h3>
        <p className="mt-2 text-sm leading-7 text-ink-muted">{children}</p>
      </div>
    </div>
  );
}
