"use client";

import { useEffect, useState } from "react";
import {
  api, faNum, ApiError,
  type Competition, type Entry, type JudgeStatus, type ChainCheck,
} from "@/lib/api";
import {
  PageHead, Table, Empty, Badge, statusLabel, statusTone,
} from "@/components/admin/ui";
import { SpotBoard } from "@/components/SpotBoard";
import { IconLock, IconCheck, IconShield, IconTarget, IconUsers } from "@/components/icons";

export default function JudgingPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [sel, setSel] = useState<Competition | null>(null);
  const [panel, setPanel] = useState<JudgeStatus[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [verify, setVerify] = useState<ChainCheck | null>(null);
  const [sealed, setSealed] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const loadComps = () =>
    api.admin.competitions().then((r) => setComps(r.competitions || [])).catch(() => {});

  useEffect(() => { void loadComps(); }, []);

  const open = async (c: Competition) => {
    setSel(c); setPanel([]); setEntries([]); setVerify(null); setSealed(false); setMsg(null);
    api.admin.panel(c.id).then((r) => setPanel(r.panel || [])).catch(() => {});
    try {
      const r = await api.admin.entries(c.id);
      setEntries(r.entries || []);
    } catch {
      // سرور در حالت باز، مختصات را برنمی‌گرداند
      setSealed(true);
    }
  };

  const runVerify = async () => {
    if (!sel) return;
    setBusy(true); setMsg(null);
    try { setVerify(await api.admin.verify(sel.id)); }
    catch (e) { setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "بررسی ناموفق بود." }); }
    finally { setBusy(false); }
  };

  const settle = async () => {
    if (!sel) return;
    if (!confirm("تسویهٔ نهایی؟ برنده تعیین و نتیجه منتشر می‌شود. این عمل بازگشت‌پذیر نیست.")) return;
    setBusy(true); setMsg(null);
    try {
      await api.admin.settle(sel.id);
      setMsg({ kind: "ok", text: "مسابقه تسویه شد و نتیجه منتشر گردید." });
      await loadComps();
      await open({ ...sel, status: "settled" });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "تسویه ناموفق بود." });
    } finally { setBusy(false); }
  };

  const committed = panel.filter((p) => p.committed).length;
  const revealed = panel.filter((p) => p.revealed).length;
  const canSettle =
    sel && ["closed", "judging"].includes(sel.status) &&
    panel.length > 0 && revealed >= committed && committed > 0;

  const avg = panel.filter((p) => p.revealed && p.x != null);
  const final = avg.length
    ? { x: avg.reduce((s, p) => s + (p.x || 0), 0) / avg.length, y: avg.reduce((s, p) => s + (p.y || 0), 0) / avg.length }
    : null;

  return (
    <>
      <PageHead
        title="پنل داوری"
        subtitle="داوران نقطهٔ خود را پیش از بسته‌شدن مسابقه قفل می‌کنند. مدیر فقط می‌تواند وضعیت را ببیند و پس از افشای همهٔ رأی‌ها تسویه را اجرا کند — امکان دیدن یا تغییر نقطه وجود ندارد."
      />

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <div>
          <Table head={["مسابقه", "وضعیت"]}>
            {comps.length === 0 && <Empty>مسابقه‌ای وجود ندارد.</Empty>}
            {comps.map((c) => (
              <tr
                key={c.id}
                onClick={() => open(c)}
                className={`cursor-pointer hover:bg-canvas-alt/40 ${sel?.id === c.id ? "bg-brand-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-bold text-ink">{c.prize?.title || c.title}</p>
                  <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{c.slug}</p>
                </td>
                <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge></td>
              </tr>
            ))}
          </Table>
        </div>

        {!sel ? (
          <div className="card flex items-center justify-center p-16 text-sm text-ink-muted">
            یک مسابقه را از فهرست انتخاب کن.
          </div>
        ) : (
          <div className="space-y-6">
            {/* وضعیت هیئت */}
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                  <IconUsers className="h-4 w-4 text-ink-muted" />
                  هیئت داوران
                </h2>
                <p className="text-xs text-ink-muted">
                  <span className="ltr-nums font-bold text-ink">{faNum(committed)}</span> قفل‌شده ·{" "}
                  <span className="ltr-nums font-bold text-ink">{faNum(revealed)}</span> افشا‌شده
                </p>
              </div>

              <div className="mt-4 divide-y divide-ink/[.05]">
                {/* پنل برای هر کاربرِ دارای نقش داور یک ردیف دارد، چه تعهد
                    داده باشد چه نه. پس فهرست خالی یعنی اصلاً حساب داوری
                    ساخته نشده — نه اینکه داوران هنوز رأی نداده‌اند. */}
                {panel.length === 0 && (
                  <p className="py-6 text-center text-xs text-ink-muted">
                    هیچ حساب کاربری با نقش «داور» وجود ندارد. از «مدیریت کاربران»
                    نقش داوران را تنظیم کن.
                  </p>
                )}
                {panel.map((j) => (
                  <div key={j.judge_id} className="flex items-center gap-3 py-3 text-sm">
                    <span className="flex-1 font-bold text-ink">{j.display_name}</span>
                    <Badge tone={j.committed ? "ok" : "mute"}>
                      <IconLock className="h-3.5 w-3.5" />
                      {j.committed ? "قفل‌شده" : "بدون تعهد"}
                    </Badge>
                    {j.revealed ? (
                      <span className="ltr-nums chip bg-brand-50 text-brand-700">
                        <IconCheck className="h-3.5 w-3.5" />
                        {j.x?.toFixed(4)} , {j.y?.toFixed(4)}
                      </span>
                    ) : (
                      <Badge tone="warn">افشا نشده</Badge>
                    )}
                  </div>
                ))}
              </div>

              {final && (
                <p className="ltr-nums mt-4 rounded-xl bg-canvas-alt px-4 py-3 text-xs text-ink-soft">
                  نقطهٔ میانگین فعلی: {final.x.toFixed(6)} , {final.y.toFixed(6)}
                </p>
              )}
            </section>

            {/* یکپارچگی */}
            <section className="card p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                  <IconShield className="h-4 w-4 text-ink-muted" />
                  بررسی زنجیرهٔ هش پیشنهادها
                </h2>
                <button onClick={runVerify} disabled={busy} className="btn-ghost !py-2 !px-4 text-xs">
                  اجرای بررسی
                </button>
              </div>

              {verify ? (
                <div className={`mt-4 rounded-xl p-4 text-sm ${
                  verify.intact ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                }`}>
                  {verify.intact ? (
                    <>
                      زنجیره سالم است —{" "}
                      <span className="ltr-nums font-bold">{faNum(verify.checked)}</span> رکورد بررسی شد.
                    </>
                  ) : (
                    <>
                      زنجیره شکسته است. اولین رکورد مشکوک:{" "}
                      <span className="ltr-nums font-bold">#{faNum(verify.first_bad_seq)}</span>.
                      یک حادثهٔ یکپارچگی به‌طور خودکار ثبت شد
                      {verify.incident_id ? (
                        <> (شمارهٔ <span className="ltr-nums font-bold">{faNum(verify.incident_id)}</span>)</>
                      ) : null}
                      {" "}و تسویهٔ این مسابقه قفل شده است. این رکورد از پنل
                      مدیریت قابل حذف یا ویرایش نیست؛ تنها ناظر مستقل می‌تواند
                      پس از رسیدگی قفل را باز کند.
                    </>
                  )}
                </div>
              ) : (
                <p className="mt-4 text-xs leading-6 text-ink-muted">
                  هر پیشنهاد با هش پیشنهاد قبلی امضا شده است. این بررسی تشخیص
                  می‌دهد آیا رکوردی پس از ثبت تغییر کرده یا حذف شده است. همین
                  بررسی هنگام تسویه هم به‌اجبار اجرا می‌شود، پس فراموش کردنش
                  خطری ایجاد نمی‌کند.
                </p>
              )}
            </section>

            {/* پیشنهادها */}
            <section className="card p-6">
              <h2 className="text-sm font-black text-ink">پیشنهادهای ثبت‌شده</h2>
              {sealed ? (
                <div className="mt-4 flex items-start gap-3 rounded-xl bg-canvas-alt p-4">
                  <IconLock className="mt-0.5 h-5 w-5 shrink-0 text-ink-muted" />
                  <p className="text-xs leading-6 text-ink-soft">
                    مختصات پیشنهادها تا زمانی که مسابقه باز است مهر‌و‌موم شده‌اند و
                    برای هیچ نقش مدیریتی قابل مشاهده نیستند. این محدودیت در سمت
                    سرور اعمال می‌شود، نه در این صفحه.
                  </p>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-xs text-ink-muted">
                    <span className="ltr-nums font-bold">{faNum(entries.length)}</span> پیشنهاد
                  </p>
                  {final && entries.length > 0 && (
                    <div className="mt-4">
                      <SpotBoard
                        image={sel.board_image}
                        markers={entries.slice(0, 300).map((e) => ({ x: e.x, y: e.y }))}
                        onAdd={() => {}}
                        onRemove={() => {}}
                        readOnly
                        reveal={final}
                      />
                    </div>
                  )}
                </>
              )}
            </section>

            {/* تسویه */}
            <section className="card p-6">
              <h2 className="flex items-center gap-2 text-sm font-black text-ink">
                <IconTarget className="h-4 w-4 text-ink-muted" />
                تسویه و اعلام برنده
              </h2>
              <ul className="mt-4 space-y-2 text-xs">
                <Check ok={sel.status !== "open"}>مسابقه بسته شده است</Check>
                <Check ok={committed > 0}>حداقل یک داور تعهد ثبت کرده است</Check>
                <Check ok={committed > 0 && revealed >= committed}>همهٔ تعهدها افشا شده‌اند</Check>
                <Check ok={verify?.intact === true}>زنجیرهٔ هش بررسی و تأیید شده است</Check>
              </ul>

              {msg && (
                <p className={`mt-4 rounded-xl px-4 py-3 text-xs ${
                  msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                }`}>
                  {msg.text}
                </p>
              )}

              <button
                onClick={settle}
                disabled={!canSettle || busy || sel.status === "settled"}
                className="btn-primary mt-5 !py-2.5 text-sm"
              >
                {sel.status === "settled" ? "تسویه شده" : busy ? "در حال اجرا…" : "اجرای تسویه"}
              </button>
              <p className="mt-3 text-xs leading-6 text-ink-muted">
                نزدیک‌ترین پیشنهاد به میانگین رأی داوران برنده می‌شود؛ در صورت
                تساوی، پیشنهادی که زودتر ثبت شده مقدم است. پس از تسویه، پاداش
                نزدیک‌ترین حدس‌ها به‌صورت خودکار به کیف پول‌ها واریز می‌شود.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${ok ? "text-emerald-700" : "text-ink-muted"}`}>
      <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
        ok ? "bg-emerald-100" : "bg-canvas-alt"
      }`}>
        {ok ? "✓" : "—"}
      </span>
      {children}
    </li>
  );
}
