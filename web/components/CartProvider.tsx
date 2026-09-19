"use client";

import { createContext, useContext, useState } from "react";

export interface Pick {
  competitionSlug: string;
  competitionTitle: string;
  /** سطح جایزه‌ای که این حدس برای آن خریده می‌شود. */
  competitionPrizeId: string;
  prizeTitle: string;
  x: number;
  y: number;
  priceCents: number;
  currency: string;
}

interface CartCtx {
  picks: Pick[];
  add: (p: Pick) => void;
  removeAt: (i: number) => void;
  clear: () => void;
  totalCents: number;
  /** گروه‌بندی برای ارسال به API */
  lines: () => {
    competition_slug: string;
    competition_prize_id: string;
    picks: { x: number; y: number }[];
  }[];
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [picks, setPicks] = useState<Pick[]>([]);

  const add = (p: Pick) => setPicks((prev) => [...prev, p]);
  const removeAt = (i: number) => setPicks((prev) => prev.filter((_, j) => j !== i));
  const clear = () => setPicks([]);

  const totalCents = picks.reduce((sum, p) => sum + p.priceCents, 0);

  // گروه‌بندی بر اساس سطح جایزه است، نه مسابقه: کاربر می‌تواند در یک دوره
  // چند حدس با جوایز مختلف بخرد و هر کدام قیمت خودش را دارد. با گروه‌بندی
  // در سطح مسابقه، همهٔ حدس‌ها به یک جایزه نسبت داده می‌شدند.
  const lines = () => {
    const byLevel = new Map<
      string,
      { competition_slug: string; competition_prize_id: string; picks: { x: number; y: number }[] }
    >();
    for (const p of picks) {
      const key = p.competitionPrizeId;
      const line =
        byLevel.get(key) ||
        { competition_slug: p.competitionSlug, competition_prize_id: key, picks: [] };
      line.picks.push({ x: p.x, y: p.y });
      byLevel.set(key, line);
    }
    return [...byLevel.values()];
  };

  return (
    <Ctx.Provider value={{ picks, add, removeAt, clear, totalCents, lines }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
