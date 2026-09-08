"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./icons";

const COLS = [
  {
    title: "بازی",
    links: [
      { label: "مسابقه‌های باز", href: "/competitions" },
      { label: "چطور کار می‌کند", href: "/how-it-works" },
      { label: "برندگان", href: "/winners" },
      { label: "ورود رایگان", href: "/free-entry" },
    ],
  },
  {
    title: "حساب من",
    links: [
      { label: "شرکت‌های من", href: "/my-entries" },
      { label: "کیف پول", href: "/wallet" },
      { label: "سفارش‌ها", href: "/orders" },
      { label: "ورود / ثبت‌نام", href: "/login" },
    ],
  },
  {
    title: "قوانین",
    links: [
      { label: "شرایط استفاده", href: "/legal/terms" },
      { label: "قوانین مسابقه", href: "/legal/rules" },
      { label: "حریم خصوصی", href: "/legal/privacy" },
      { label: "بازی مسئولانه", href: "/legal/responsible" },
    ],
  },
];

export function SiteFooter() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <footer className="mt-24 border-t border-ink/[.07] bg-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <Logo className="h-9 w-9" />
              <span className="text-base font-black text-ink">به سوی رویا</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-ink-muted">
              یک رقابت مهارتی نشانه‌گذاری توپ. برنده کسی است که نزدیک‌ترین
              نقطه به نظر هیئت داوران مستقل را انتخاب کند — نه شانس، نه قرعه.
            </p>
            <p className="mt-4 text-xs leading-6 text-ink-muted">
              ورود رایگان از طریق پست همیشه در دسترس است و هیچ تفاوتی در شانس
              برنده‌شدن ایجاد نمی‌کند.
            </p>
          </div>

          {COLS.map((c) => (
            <div key={c.title}>
              <h4 className="text-sm font-black text-ink">{c.title}</h4>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-ink-muted transition hover:text-brand-600"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-ink/[.07] pt-6 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© ۱۴۰۵ به سوی رویا. تمام حقوق محفوظ است.</p>
          <p>
            شرکت‌کنندگان باید ۱۸ سال یا بیشتر داشته باشند. کارکنان و پیمانکاران
            مجاز به شرکت نیستند.
          </p>
        </div>
      </div>
    </footer>
  );
}
