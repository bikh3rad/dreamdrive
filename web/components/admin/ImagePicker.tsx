"use client";

import { useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

/**
 * انتخاب تصویر برای پنل مدیریت.
 *
 * دو راه می‌دهد: آپلود فایل از کامپیوتر (به انبارهٔ فایل سرور می‌رود) یا
 * چسباندن نشانی یک تصویر بیرونی. راه دوم عمداً حذف نشده چون گاهی عکس
 * روی CDN خودت هست و آپلود دوباره‌اش بی‌معنی است.
 */
export function ImagePicker({
  value,
  onChange,
  folder = "prizes",
  label = "تصویر",
  aspect = "aspect-[16/7]",
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: "prizes" | "boards" | "pages" | "brand";
  label?: string;
  aspect?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr("");
    try {
      const r = await api.admin.upload(file, folder);
      onChange(r.url);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "آپلود ناموفق بود.");
    } finally {
      setBusy(false);
      // ریست می‌کنیم تا انتخاب دوبارهٔ همان فایل هم رویداد change بدهد
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <label className="label">{label}</label>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void upload(f);
        }}
        className="rounded-xl border border-dashed border-ink/15 bg-canvas-alt/40 p-3"
      >
        {value ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className={`w-full rounded-lg object-cover ${aspect}`} />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute end-2 top-2 rounded-lg bg-ink/70 px-2 py-1 text-[11px] font-bold text-white hover:bg-ink"
            >
              حذف
            </button>
          </div>
        ) : (
          <div className={`flex ${aspect} w-full items-center justify-center rounded-lg bg-canvas-alt text-xs text-ink-muted`}>
            تصویری انتخاب نشده
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="btn-ghost !py-2 !px-4 text-xs"
          >
            {busy ? "در حال آپلود…" : "انتخاب فایل"}
          </button>
          <span className="text-[11px] text-ink-muted">
            یا فایل را همین‌جا رها کن — تا ۸ مگابایت، JPG/PNG/WebP
          </span>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </div>

      <input
        className="field mt-2 text-start text-xs"
        dir="ltr"
        placeholder="یا نشانی تصویر را اینجا بچسبان"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      {err && <p className="mt-1.5 text-xs text-red-600">{err}</p>}
    </div>
  );
}
