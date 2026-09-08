"use client";

import { useCallback, useRef, useState } from "react";
import { faNum } from "@/lib/api";
import { IconTarget, IconX } from "./icons";

export interface Marker {
  x: number; // 0..1
  y: number; // 0..1
}

interface Props {
  image: string;
  markers: Marker[];
  onAdd: (m: Marker) => void;
  onRemove: (i: number) => void;
  /** نقطهٔ داوران — فقط پس از تسویه */
  reveal?: Marker | null;
  readOnly?: boolean;
}

const ZOOMS = [1, 1.75, 2.5, 4];

export function SpotBoard({ image, markers, onAdd, onRemove, reveal, readOnly }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [origin, setOrigin] = useState({ x: 0.5, y: 0.5 });
  const [hover, setHover] = useState<Marker | null>(null);

  const toNorm = useCallback((e: React.MouseEvent): Marker | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    // مختصات نمایش‌داده‌شده
    const vx = (e.clientX - r.left) / r.width;
    const vy = (e.clientY - r.top) / r.height;
    // بازگرداندن اثر بزرگ‌نمایی حول نقطهٔ origin
    const x = origin.x + (vx - origin.x) / zoom;
    const y = origin.y + (vy - origin.y) / zoom;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
  }, [origin, zoom]);

  const place = (e: React.MouseEvent) => {
    if (readOnly) return;
    const m = toNorm(e);
    if (m) onAdd(m);
  };

  // موقعیت نمایشی یک نقطهٔ نرمال‌شده داخل قاب
  const view = (m: Marker) => ({
    left: `${(origin.x + (m.x - origin.x) * zoom) * 100}%`,
    top: `${(origin.y + (m.y - origin.y) * zoom) * 100}%`,
  });

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        onClick={place}
        onMouseMove={(e) => setHover(toNorm(e))}
        onMouseLeave={() => setHover(null)}
        className={`relative aspect-[3/2] w-full select-none overflow-hidden rounded-card border border-ink/10 bg-ink ${
          readOnly ? "" : "cursor-crosshair"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt="تصویر مسابقه"
          draggable={false}
          className="pointer-events-none h-full w-full object-cover transition-transform duration-200"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: `${origin.x * 100}% ${origin.y * 100}%`,
          }}
        />

        {/* خطوط راهنمای متقاطع */}
        {hover && !readOnly && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-white/40" style={{ left: view(hover).left }} />
            <div className="pointer-events-none absolute inset-x-0 h-px bg-white/40" style={{ top: view(hover).top }} />
          </>
        )}

        {/* نقطه‌های ثبت‌شده */}
        {markers.map((m, i) => (
          <button
            key={`${m.x}-${m.y}-${i}`}
            onClick={(e) => { e.stopPropagation(); if (!readOnly) onRemove(i); }}
            style={view(m)}
            title={readOnly ? undefined : "حذف این نقطه"}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
          >
            <span className="relative flex h-7 w-7 items-center justify-center">
              <span className="absolute inset-0 rounded-full border-2 border-brand-500 bg-brand-500/25" />
              <span className="absolute inset-[9px] rounded-full bg-brand-500" />
              <span className="absolute -top-6 hidden rounded bg-ink px-1.5 py-0.5 text-[10px] font-bold text-white group-hover:block">
                {faNum(i + 1)}
              </span>
            </span>
          </button>
        ))}

        {/* نقطهٔ داوران */}
        {reveal && (
          <span style={view(reveal)} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2">
            <span className="relative flex h-9 w-9 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-white/40" />
              <IconTarget className="h-9 w-9 text-white drop-shadow" />
            </span>
          </span>
        )}

        {/* کنترل بزرگ‌نمایی */}
        <div className="absolute bottom-3 start-3 flex items-center gap-1 rounded-full bg-ink/75 p-1 backdrop-blur">
          {ZOOMS.map((z) => (
            <button
              key={z}
              onClick={(e) => {
                e.stopPropagation();
                setZoom(z);
                if (z === 1) setOrigin({ x: 0.5, y: 0.5 });
                else if (hover) setOrigin(hover);
              }}
              className={`ltr-nums rounded-full px-2.5 py-1 text-[11px] font-bold transition ${
                zoom === z ? "bg-brand-500 text-ink" : "text-white/75 hover:text-white"
              }`}
            >
              ×{z}
            </button>
          ))}
        </div>

        {hover && !readOnly && (
          <div className="ltr-nums pointer-events-none absolute bottom-3 end-3 rounded-full bg-ink/75 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur">
            {hover.x.toFixed(3)} , {hover.y.toFixed(3)}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-ink-muted">
          <p>
            روی تصویر کلیک کن تا نقطه ثبت شود. برای حذف، روی نقطه کلیک کن.
            برای دقت بیشتر از بزرگ‌نمایی استفاده کن.
          </p>
          {markers.length > 0 && (
            <button
              onClick={() => markers.forEach((_, i) => onRemove(markers.length - 1 - i))}
              className="flex items-center gap-1 font-bold text-ink-soft hover:text-ink"
            >
              <IconX className="h-3.5 w-3.5" />
              پاک کردن همه
            </button>
          )}
        </div>
      )}
    </div>
  );
}
