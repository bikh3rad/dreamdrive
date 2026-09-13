"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useAuth, isAdmin, isJudge, isAuditor } from "./AuthProvider";
import { useCart } from "./CartProvider";
import { faNum } from "@/lib/api";
import { Logo, IconTicket, IconGift, IconSettings, IconMenu, IconScale, IconShield } from "./icons";

const NAV = [
  { label: "خانه", href: "/" },
  { label: "بازی", href: "/play" },
  { label: "چطور کار می‌کند", href: "/how-it-works" },
  { label: "شرکت‌های من", href: "/my-entries", auth: true },
  { label: "کیف پول", href: "/wallet", auth: true },
  { label: "برندگان", href: "/winners" },
];

export function SiteHeader() {
  const { user, logout } = useAuth();
  const { picks } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // پنل ادمین چیدمان خودش را دارد
  if (pathname?.startsWith("/admin")) return null;

  const freeLeft = user ? 3 : 0;

  return (
    <header className="sticky top-0 z-50 border-b border-ink/[.06] bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <Logo className="h-9 w-9" />
          <span className="text-base font-black leading-tight text-ink">
            به سوی رویا
          </span>
        </Link>

        <nav className="mx-2 hidden flex-1 items-center gap-1 lg:flex">
          {NAV.filter((n) => !n.auth || user).map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-2 text-sm font-bold transition ${
                  active ? "bg-brand-100 text-brand-700" : "text-ink-soft hover:bg-canvas-alt hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {isJudge(user) && (
            <Link
              href="/judge"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50"
            >
              <IconScale className="h-4 w-4" />
              کنسول داوری
            </Link>
          )}
          {isAuditor(user) && (
            <Link
              href="/audit"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50"
            >
              <IconShield className="h-4 w-4" />
              نظارت مستقل
            </Link>
          )}
          {isAdmin(user) && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-brand-600 hover:bg-brand-50"
            >
              <IconSettings className="h-4 w-4" />
              مدیریت
            </Link>
          )}
        </nav>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          {user && (
            <div className="hidden items-center divide-x divide-x-reverse divide-ink/10 rounded-full border border-ink/10 bg-white px-1 sm:flex">
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <IconTicket className="h-4 w-4 text-ink-muted" />
                <span className="text-xs font-bold">
                  <span className="ltr-nums">{faNum(picks.length)}</span>{" "}
                  <span className="muted font-medium">پیشنهاد</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <IconGift className="h-4 w-4 text-brand-500" />
                <span className="text-xs font-bold">
                  <span className="ltr-nums">{faNum(freeLeft)}</span>{" "}
                  <span className="muted font-medium">رایگان</span>
                </span>
              </div>
            </div>
          )}

          {user ? (
            <button onClick={logout} className="hidden rounded-full p-2 text-ink-muted hover:bg-canvas-alt sm:block" title="خروج">
              <IconSettings className="h-5 w-5" />
            </button>
          ) : (
            <Link href="/login" className="hidden text-sm font-bold text-ink-soft hover:text-ink sm:block">
              ورود
            </Link>
          )}

          <Link href="/play" className="btn-primary !px-5 !py-2.5 text-sm">
            همین حالا بازی کن
          </Link>

          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg p-2 text-ink lg:hidden"
            aria-label="منو"
          >
            <IconMenu className="h-6 w-6" />
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-ink/[.06] bg-white px-4 py-3 lg:hidden">
          {NAV.filter((n) => !n.auth || user).map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-bold text-ink-soft hover:bg-canvas-alt"
            >
              {n.label}
            </Link>
          ))}
          {isJudge(user) && (
            <Link href="/judge" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-bold text-brand-600">
              کنسول داوری
            </Link>
          )}
          {isAuditor(user) && (
            <Link href="/audit" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-bold text-brand-600">
              نظارت مستقل
            </Link>
          )}
          {isAdmin(user) && (
            <Link href="/admin" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-bold text-brand-600">
              پنل مدیریت
            </Link>
          )}
          {user ? (
            <button onClick={logout} className="block w-full rounded-lg px-3 py-2.5 text-start text-sm font-bold text-ink-soft">
              خروج
            </button>
          ) : (
            <Link href="/login" onClick={() => setOpen(false)}
              className="block rounded-lg px-3 py-2.5 text-sm font-bold text-ink-soft">
              ورود
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
