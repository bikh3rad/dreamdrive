"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** سفارش‌ها بخشی از کیف پول است */
export default function OrdersIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/wallet"); }, [router]);
  return <div className="py-24 text-center text-ink-muted">…</div>;
}
