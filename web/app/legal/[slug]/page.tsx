"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Markdown } from "@/components/Markdown";

export default function LegalPage({ params }: { params: { slug: string } }) {
  const [page, setPage] = useState<{ title: string; body_md: string } | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api.page(params.slug).then(setPage).catch(() => setMissing(true));
  }, [params.slug]);

  if (missing)
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center sm:px-6">
        <h1 className="text-2xl font-black text-ink">این صفحه هنوز منتشر نشده است</h1>
        <p className="mt-3 text-sm text-ink-muted">
          مدیر سایت می‌تواند آن را از بخش «مدیریت محتوا → صفحه‌ها» اضافه کند.
        </p>
      </div>
    );

  if (!page)
    return <div className="py-24 text-center text-ink-muted">در حال بارگذاری…</div>;

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="h-section">{page.title}</h1>
      <div className="mt-8">
        <Markdown source={page.body_md} />
      </div>
    </article>
  );
}
