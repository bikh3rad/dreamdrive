"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth, isAdmin } from "@/components/AuthProvider";
import {
  Logo, IconChart, IconBox, IconCalendar, IconFile, IconUsers,
  IconWallet, IconSettings, IconTarget, IconShield, IconLogout,
} from "@/components/icons";
import { roleLabel } from "@/components/admin/ui";

/** هر بخش با نقش‌های مجاز آن. superadmin همیشه مجاز است. */
const SECTIONS: {
  title: string;
  items: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; roles: string[] }[];
}[] = [
  {
    title: "نمای کلی",
    items: [
      { href: "/admin", label: "داشبورد", icon: IconChart, roles: ["support", "content_admin", "finance_admin"] },
    ],
  },
  {
    title: "مدیریت محتوا",
    items: [
      { href: "/admin/prizes", label: "جایزه‌ها", icon: IconBox, roles: ["content_admin"] },
      { href: "/admin/competitions", label: "مسابقه‌ها", icon: IconCalendar, roles: ["content_admin"] },
      { href: "/admin/pages", label: "صفحه‌ها", icon: IconFile, roles: ["content_admin"] },
    ],
  },
  {
    title: "کاربران",
    items: [
      { href: "/admin/users", label: "کاربران و نقش‌ها", icon: IconUsers, roles: ["support"] },
    ],
  },
  {
    title: "سفارش و پرداخت",
    items: [
      { href: "/admin/orders", label: "سفارش‌ها", icon: IconWallet, roles: ["finance_admin"] },
      { href: "/admin/reports", label: "گزارش درآمد", icon: IconChart, roles: ["finance_admin"] },
    ],
  },
  {
    title: "داوری و امنیت",
    items: [
      { href: "/admin/judging", label: "پنل داوری", icon: IconTarget, roles: [] },
      { href: "/admin/audit", label: "گزارش ممیزی", icon: IconShield, roles: [] },
    ],
  },
  {
    title: "پیکربندی",
    items: [
      { href: "/admin/settings", label: "تنظیمات و ظاهر", icon: IconSettings, roles: ["content_admin"] },
    ],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin(user)) router.replace("/login?next=/admin");
  }, [loading, user, router]);

  if (loading || !isAdmin(user)) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-ink-muted">
        در حال بررسی دسترسی…
      </div>
    );
  }

  // roles خالی یعنی «فقط مدیر کل»
  const may = (roles: string[]) =>
    user!.role === "superadmin" || roles.includes(user!.role);

  return (
    <div className="flex min-h-screen bg-canvas-alt">
      {/* ---- نوار کناری ---- */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-ink/[.07] bg-white lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-5 py-5">
          <Logo className="h-9 w-9" />
          <div>
            <p className="text-sm font-black leading-tight text-ink">به سوی رویا</p>
            <p className="text-[11px] text-ink-muted">پنل مدیریت</p>
          </div>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {SECTIONS.map((s) => {
            const items = s.items.filter((i) => may(i.roles));
            if (!items.length) return null;
            return (
              <div key={s.title} className="mb-5">
                <p className="mb-1.5 px-3 text-[11px] font-bold text-ink-muted">{s.title}</p>
                {items.map((i) => {
                  const active = pathname === i.href;
                  return (
                    <Link
                      key={i.href}
                      href={i.href}
                      className={`mb-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold transition ${
                        active
                          ? "bg-brand-500 text-ink shadow-[0_2px_8px_rgba(240,168,40,.3)]"
                          : "text-ink-soft hover:bg-canvas-alt"
                      }`}
                    >
                      <i.icon className="h-4 w-4" />
                      {i.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="border-t border-ink/[.07] p-3">
          <div className="rounded-xl bg-canvas-alt p-3">
            <p className="truncate text-xs font-black text-ink">{user!.full_name}</p>
            <p className="mt-0.5 text-[11px] text-ink-muted">{roleLabel(user!.role)}</p>
          </div>
          <div className="mt-2 flex gap-2">
            <Link href="/" className="flex-1 rounded-xl px-3 py-2 text-center text-xs font-bold text-ink-soft hover:bg-canvas-alt">
              مشاهدهٔ سایت
            </Link>
            <button onClick={logout} className="rounded-xl p-2 text-ink-muted hover:bg-canvas-alt" title="خروج">
              <IconLogout className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ---- محتوا ---- */}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-ink/[.07] bg-white/85 px-5 backdrop-blur lg:hidden">
          <Logo className="h-8 w-8" />
          <span className="text-sm font-black text-ink">پنل مدیریت</span>
          <Link href="/" className="ms-auto text-xs font-bold text-brand-600">سایت</Link>
        </header>

        {/* پیمایش افقی در موبایل */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-ink/[.07] bg-white px-4 py-2 lg:hidden">
          {SECTIONS.flatMap((s) => s.items).filter((i) => may(i.roles)).map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-bold ${
                pathname === i.href ? "bg-brand-500 text-ink" : "bg-canvas-alt text-ink-soft"
              }`}
            >
              {i.label}
            </Link>
          ))}
        </nav>

        <main className="p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
