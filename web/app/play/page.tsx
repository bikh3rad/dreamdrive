"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { FALLBACK_COMPETITIONS } from "@/lib/fallback";

/** «بازی» بدون اسلاگ → اولین مسابقهٔ باز */
export default function PlayIndex() {
  const router = useRouter();

  useEffect(() => {
    api.competitions()
      .then((r) => {
        const open = r.competitions?.find((c) => c.status === "open");
        router.replace(open ? `/play/${open.slug}` : "/competitions");
      })
      .catch(() => router.replace(`/play/${FALLBACK_COMPETITIONS[0].slug}`));
  }, [router]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-24 text-center text-ink-muted">
      در حال باز کردن مسابقهٔ فعال…
    </div>
  );
}
