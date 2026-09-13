"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

/** «بازی» بدون اسلاگ → اولین مسابقهٔ باز */
export default function PlayIndex() {
  const router = useRouter();

  useEffect(() => {
    api.competitions()
      .then((r) => {
        const open = r.competitions?.find((c) => c.status === "open");
        router.replace(open ? `/play/${open.slug}` : "/competitions");
      })
      // فرستادن کاربر به slug نمونه یعنی صفحهٔ بازیِ جعلی؛ بهتر است به
      // فهرست مسابقه‌ها برود که خودش خطا را درست نشان می‌دهد.
      .catch(() => router.replace("/competitions"));
  }, [router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center text-ink-muted">
      در حال باز کردن مسابقهٔ فعال…
    </div>
  );
}
