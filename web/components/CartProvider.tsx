"use client";

import { createContext, useContext, useState } from "react";

export interface Pick {
  competitionSlug: string;
  competitionTitle: string;
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
  lines: () => { competition_slug: string; picks: { x: number; y: number }[] }[];
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [picks, setPicks] = useState<Pick[]>([]);

  const add = (p: Pick) => setPicks((prev) => [...prev, p]);
  const removeAt = (i: number) => setPicks((prev) => prev.filter((_, j) => j !== i));
  const clear = () => setPicks([]);

  const totalCents = picks.reduce((sum, p) => sum + p.priceCents, 0);

  const lines = () => {
    const byComp = new Map<string, { x: number; y: number }[]>();
    for (const p of picks) {
      const arr = byComp.get(p.competitionSlug) || [];
      arr.push({ x: p.x, y: p.y });
      byComp.set(p.competitionSlug, arr);
    }
    return [...byComp.entries()].map(([competition_slug, picks]) => ({
      competition_slug,
      picks,
    }));
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
