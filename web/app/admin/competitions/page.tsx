"use client";

import { useEffect, useState } from "react";
import {
  activeLevels, api, faNum, money, startingPrice, toman, ApiError,
  type Competition, type Prize,
} from "@/lib/api";
import {
  PageHead, Table, Empty, Modal, Badge, statusLabel, statusTone,
} from "@/components/admin/ui";
import { ImagePicker } from "@/components/admin/ImagePicker";

const FLOW: Record<string, { next: string; label: string }[]> = {
  draft: [{ next: "open", label: "باز کردن" }, { next: "cancelled", label: "لغو" }],
  open: [{ next: "closed", label: "بستن" }],
  closed: [{ next: "judging", label: "شروع داوری" }],
  judging: [],
  settled: [],
  cancelled: [],
};

function toLocalInput(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function AdminCompetitionsPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // دوره‌های «باز ولی پر»: شرط بسته‌شدنشان رسیده ولی چون هیچ داوری تعهد ثبت
  // نکرده، جارو عمداً نمی‌بنددشان. در فهرست اصلی از یک دورهٔ سالمِ باز قابل
  // تشخیص نیستند، پس جدا نشان داده می‌شوند.
  const [stuck, setStuck] = useState<Competition[]>([]);

  const load = () =>
    Promise.all([
      api.admin.competitions().then((r) => setComps(r.competitions || [])),
      // خطایش کشنده نیست؛ نبودِ هشدار بهتر از صفحهٔ خالیِ مسابقه‌هاست.
      api.admin.stuckCompetitions().then((r) => setStuck(r.competitions || [])).catch(() => {}),
    ]).catch(() => {});
  useEffect(() => {
    void load();
    api.admin.prizes().then((r) => setPrizes(r.prizes || [])).catch(() => {});
  }, []);

  const blank = () => ({
    slug: "", title: "", currency: "IRR", board_image: "",
    // datetime-local مقدار ISO با Z و میلی‌ثانیه را نمی‌پذیرد و خالی نشان
    // می‌دهد؛ بعد new Date("") در ذخیره خطای Invalid time value می‌دهد.
    opens_at: toLocalInput(new Date().toISOString()),
    closes_at: toLocalInput(new Date(Date.now() + 7 * 86400000).toISOString()),
    max_entries_user: 100, status: "draft",
    // قاعدهٔ کسب‌وکار: دوره با ۲۰٬۰۰۰ حدس آمادهٔ داوری می‌شود.
    entry_target: 20000,
    levels: [
      { prize_id: prizes[0]?.id || "", ticket_price_cents: 5_000_000, is_active: true },
    ],
  });

  // مسابقهٔ موجود را به شکل فرم درمی‌آورد. سطوح غیرفعال هم آورده می‌شوند،
  // چون حذف‌شان از فرم به‌معنای حذف‌شان از مسابقه است و ادمین باید ببیندشان.
  const toForm = (c: Competition) => ({
    ...c,
    opens_at: toLocalInput(c.opens_at),
    closes_at: toLocalInput(c.closes_at),
    levels: (c.prizes || [])
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((l) => ({
        prize_id: l.prize_id,
        ticket_price_cents: l.ticket_price_cents,
        is_active: l.is_active,
      })),
  });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      const levels = (edit.levels || []).filter((l: any) => l.prize_id);
      if (levels.length === 0) {
        setErr("دست‌کم یک جایزه لازم است؛ بدون آن مسابقه قابل خرید نیست.");
        setBusy(false);
        return;
      }
      // جایزهٔ تکراری را سرور با خطا رد می‌کند، اما پیام اینجا روشن‌تر است.
      const ids = new Set(levels.map((l: any) => l.prize_id));
      if (ids.size !== levels.length) {
        setErr("یک جایزه دوبار انتخاب شده است.");
        setBusy(false);
        return;
      }
      // تاریخِ خالی یا ناخوانا اینجا گرفته می‌شود؛ وگرنه toISOString یک
      // RangeError پرتاب می‌کند که به پیام مبهم «ذخیره ناموفق بود» تبدیل می‌شد.
      const opens = new Date(edit.opens_at);
      const closes = new Date(edit.closes_at);
      if (isNaN(opens.getTime()) || isNaN(closes.getTime())) {
        setErr("زمان باز و بسته شدن را کامل وارد کنید.");
        setBusy(false);
        return;
      }
      if (closes <= opens) {
        setErr("زمان بسته شدن باید بعد از زمان باز شدن باشد.");
        setBusy(false);
        return;
      }
      // فیلدِ خالی را Number به ۰ تبدیل می‌کند و ۰ یعنی «بدون سقف» — یعنی یک
      // پاک‌کردن تصادفی، دوره‌ای را که باید سر ۲۰٬۰۰۰ حدس بسته شود بی‌صدا
      // بی‌سقف می‌کرد. «بدون سقف» باید انتخابی صریح باشد.
      const rawTarget = String(edit.entry_target ?? "").trim();
      if (rawTarget === "") {
        setErr("سقف شرکت‌کننده را وارد کنید؛ برای «بدون سقف» صریحاً ۰ بنویسید.");
        setBusy(false);
        return;
      }
      const target = Number(rawTarget);
      if (isNaN(target) || target < 0) {
        setErr("سقف شرکت‌کننده باید عددی نامنفی باشد (۰ یعنی بدون سقف).");
        setBusy(false);
        return;
      }
      // همان تلهٔ entry_target برای سقف هر کاربر هم هست، ولی نتیجه‌اش بدتر
      // است: ۰ یعنی «بدون محدودیت»، پس یک فیلدِ تصادفاً پاک‌شده سقف خرید هر
      // کاربر را برمی‌دارد و یک نفر می‌تواند کل استخر را بخرد.
      const rawPerUser = String(edit.max_entries_user ?? "").trim();
      if (rawPerUser === "") {
        setErr("سقف هر کاربر را وارد کنید؛ برای «بدون محدودیت» صریحاً ۰ بنویسید.");
        setBusy(false);
        return;
      }
      const perUser = Number(rawPerUser);
      if (isNaN(perUser) || perUser < 0) {
        setErr("سقف هر کاربر باید عددی نامنفی باشد (۰ یعنی بدون محدودیت).");
        setBusy(false);
        return;
      }

      // پایین آوردن سقف زیر تعداد فعلی، دوره را در جارویِ بعدی می‌بندد.
      // این کار گاهی عمدی است، ولی نباید بی‌خبر اتفاق بیفتد.
      const already = edit.entry_count ?? 0;
      if (target > 0 && already >= target && edit.status === "open") {
        if (!confirm(
          `این مسابقه هم‌اکنون ${faNum(already.toLocaleString("en-US"))} حدس دارد ` +
          `که از سقف ${faNum(target.toLocaleString("en-US"))} کمتر نیست؛ ` +
          `با ذخیره، دوره در جاروی بعدی بسته و آمادهٔ داوری می‌شود. ادامه؟`
        )) { setBusy(false); return; }
      }
      // فقط کلیدهای CompetitionInput؛ سرور فیلدهای اضافی (id، prize، …) را رد می‌کند.
      //
      // status عمداً فرستاده نمی‌شود: سرور دیگر آن را از این مسیر نمی‌نویسد و
      // تغییر وضعیت فقط از دکمه‌های چرخهٔ عمر انجام می‌شود. حالا که دوره
      // می‌تواند خودکار (با رسیدن به سقف) بسته شود، status این فرم همیشه
      // ممکن است کهنه باشد.
      const body = {
        slug: edit.slug || "",
        title: edit.title || "",
        currency: edit.currency || "IRR",
        board_image: edit.board_image || "",
        opens_at: opens.toISOString(),
        closes_at: closes.toISOString(),
        max_entries_user: perUser,
        entry_target: target,
        prizes: levels.map((l: any, i: number) => ({
          prize_id: l.prize_id,
          ticket_price_cents: Number(l.ticket_price_cents),
          sort: i,
          is_active: !!l.is_active,
        })),
      };
      if (edit.id) await api.admin.updateCompetition(edit.id, body);
      else await api.admin.createCompetition(body);
      setEdit(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ذخیره ناموفق بود.");
    } finally { setBusy(false); }
  };

  const setLevel = (i: number, patch: Record<string, unknown>) =>
    setEdit((p: any) => ({
      ...p,
      levels: p.levels.map((l: any, j: number) => (j === i ? { ...l, ...patch } : l)),
    }));

  const addLevel = () =>
    setEdit((p: any) => ({
      ...p,
      levels: [
        ...p.levels,
        { prize_id: "", ticket_price_cents: 5_000_000, is_active: true },
      ],
    }));

  const removeLevel = (i: number) =>
    setEdit((p: any) => ({ ...p, levels: p.levels.filter((_: any, j: number) => j !== i) }));

  const move = async (c: Competition, next: string) => {
    const warn = next === "closed"
      ? "پس از بستن، دیگر پیشنهاد جدیدی پذیرفته نمی‌شود و داوران می‌توانند رأی خود را افشا کنند. ادامه؟"
      : `تغییر وضعیت به «${statusLabel(next)}»؟`;
    if (!confirm(warn)) return;
    try { await api.admin.setStatus(c.id, next); await load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "تغییر وضعیت ناموفق بود."); }
  };

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setEdit((p: any) => ({ ...p, [k]: e.target.value }));

  return (
    <>
      <PageHead
        title="مسابقه‌ها"
        subtitle="چرخهٔ هر مسابقه: پیش‌نویس ← باز ← بسته ← داوری ← تسویه. مختصات پیشنهادها تا پیش از بسته‌شدن برای هیچ نقشی قابل مشاهده نیست."
        action={
          <button onClick={() => setEdit(blank())} className="btn-primary !py-2.5 text-sm">
            مسابقهٔ جدید
          </button>
        }
      />

      {stuck.length > 0 && (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-5">
          <h3 className="text-sm font-black text-amber-900">
            منتظر تعهد داوران
          </h3>
          <p className="mt-1 text-xs leading-6 text-amber-900/80">
            این دوره‌ها به سقف حدس یا به زمان پایان رسیده‌اند، ولی چون هیچ داوری
            هنوز هشِ تعهدش را ثبت نکرده، عمداً بسته نمی‌شوند: دوره‌ای که پیش از
            ثبت تعهدها بسته شود دیگر نه تعهد می‌پذیرد و نه قابل تسویه است. تا
            ثبت تعهد، خرید تازه هم پذیرفته نمی‌شود.
          </p>
          <ul className="mt-3 space-y-1 text-xs">
            {stuck.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="font-bold text-amber-900">{c.prize?.title || c.title}</span>
                <span className="ltr-nums text-amber-900/70">
                  {faNum((c.entry_count ?? 0).toLocaleString("en-US"))}
                  {c.entry_target > 0 && ` / ${faNum(c.entry_target.toLocaleString("en-US"))}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Table head={["عنوان", "وضعیت", "قیمت", "بازه", "سقف کاربر", "شرکت‌کننده", "درآمد", "اقدام"]}>
        {comps.length === 0 && <Empty>هنوز مسابقه‌ای ساخته نشده است.</Empty>}
        {comps.map((c) => (
          <tr key={c.id} className="hover:bg-canvas-alt/40">
            <td className="px-4 py-3">
              <p className="font-bold text-ink">{c.prize?.title || c.title}</p>
              <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{c.slug}</p>
            </td>
            <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge></td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">
              {activeLevels(c).length > 1 && <span className="text-ink-muted">از </span>}
              {money(startingPrice(c) ?? 0, c.currency)}
              {activeLevels(c).length > 1 && (
                <span className="ms-1 text-xs text-ink-muted">
                  ({faNum(activeLevels(c).length)} جایزه)
                </span>
              )}
            </td>
            <td className="px-4 py-3 text-xs text-ink-soft">
              {new Date(c.opens_at).toLocaleDateString("fa-IR")} –{" "}
              {new Date(c.closes_at).toLocaleDateString("fa-IR")}
            </td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{faNum(c.max_entries_user)}</td>
            <td className="px-4 py-3 text-ink-soft">
              <span className="ltr-nums">
                {faNum((c.entry_count ?? 0).toLocaleString("en-US"))}
                {c.entry_target > 0 && (
                  <span className="text-ink-muted">
                    {" / "}
                    {faNum(c.entry_target.toLocaleString("en-US"))}
                  </span>
                )}
              </span>
              {c.entry_target > 0 && (
                <span className="mt-1 block h-1 w-20 overflow-hidden rounded-full bg-ink/10">
                  <span
                    className="block h-full rounded-full bg-brand-500"
                    style={{
                      width: `${Math.min(100, ((c.entry_count ?? 0) / c.entry_target) * 100)}%`,
                    }}
                  />
                </span>
              )}
            </td>
            {/* درآمد فقط از سفارش‌های پرداخت‌شده؛ سفارش در انتظار و بازگشتی شمرده نمی‌شود. */}
            <td className="ltr-nums px-4 py-3 font-bold text-ink">
              {money(c.revenue_cents ?? 0, c.currency)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-end">
              <button
                onClick={() => setEdit(toForm(c))}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                ویرایش
              </button>
              {(FLOW[c.status] || []).map((f) => (
                <button
                  key={f.next}
                  onClick={() => move(c, f.next)}
                  className="ms-3 text-xs font-bold text-ink-soft hover:text-ink hover:underline"
                >
                  {f.label}
                </button>
              ))}
            </td>
          </tr>
        ))}
      </Table>

      {edit && (
        <Modal title={edit.id ? "ویرایش مسابقه" : "مسابقهٔ جدید"} onClose={() => setEdit(null)} wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">عنوان داخلی</label>
              <input className="field" value={edit.title} onChange={set("title")} />
            </div>
            <div>
              <label className="label">شناسهٔ نشانی (slug)</label>
              <input className="field text-start" dir="ltr" value={edit.slug} onChange={set("slug")} />
            </div>
            <div>
              <label className="label">واحد پول</label>
              <select className="field" value={edit.currency} onChange={set("currency")}>
                <option value="IRR">IRR — ریال</option>
                <option value="CAD">CAD</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
              </select>
            </div>
            <div>
              <label className="label">زمان باز شدن</label>
              <input className="field text-start" dir="ltr" type="datetime-local" value={edit.opens_at} onChange={set("opens_at")} />
            </div>
            <div>
              <label className="label">زمان بسته شدن</label>
              <input className="field text-start" dir="ltr" type="datetime-local" value={edit.closes_at} onChange={set("closes_at")} />
              <p className="mt-1.5 text-xs text-ink-muted">
                مهلت زمانی دوره.
              </p>
            </div>
            <div>
              <label className="label">سقف شرکت‌کننده (آمادهٔ داوری)</label>
              <input
                className="field text-start" dir="ltr" type="number" min={0}
                value={edit.entry_target ?? 0}
                onChange={set("entry_target")}
              />
              <p className="mt-1.5 text-xs leading-6 text-ink-muted">
                با رسیدن تعداد حدس‌ها به این عدد، مسابقه بسته و آمادهٔ داوری
                می‌شود — حتی اگر هنوز به زمان بسته شدن نرسیده باشد. هر کدام از
                این دو شرط زودتر رخ دهد، دوره را تمام می‌کند. ۰ یعنی بدون سقف و
                فقط زمان تعیین‌کننده است.
              </p>
            </div>
            <div>
              <label className="label">سقف پیشنهاد هر کاربر</label>
              <input className="field text-start" dir="ltr" type="number" min={0} value={edit.max_entries_user} onChange={set("max_entries_user")} />
              <p className="mt-1.5 text-xs text-ink-muted">
                محدودیت هر حساب، نه کل دوره.
              </p>
            </div>
            <div className="sm:col-span-2">
              <ImagePicker
                label="تصویر تخته (بدون توپ)"
                folder="boards"
                aspect="aspect-[3/2]"
                value={edit.board_image}
                onChange={(url) => setEdit({ ...edit, board_image: url })}
              />
            </div>
          </div>

          {/* ---- سطوح جایزه ---- */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <label className="label !mb-0">جایزه‌ها و قیمت بلیط</label>
              <button
                type="button"
                onClick={addLevel}
                className="text-xs font-bold text-brand-600 hover:underline"
              >
                + افزودن جایزه
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {(edit.levels || []).map((l: any, i: number) => (
                <div key={i} className="rounded-xl border border-ink/[.10] p-3">
                  <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto]">
                    <div>
                      <label className="label">جایزه</label>
                      <select
                        className="field"
                        value={l.prize_id}
                        onChange={(e) => setLevel(i, { prize_id: e.target.value })}
                      >
                        <option value="">— انتخاب کنید —</option>
                        {prizes.map((p) => (
                          <option key={p.id} value={p.id}>{p.title}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">
                        قیمت هر پیشنهاد {edit.currency === "IRR" ? "(ریال)" : "(سنت)"}
                      </label>
                      <input
                        className="field text-start"
                        dir="ltr"
                        type="number"
                        value={l.ticket_price_cents}
                        onChange={(e) => setLevel(i, { ticket_price_cents: e.target.value })}
                      />
                      {edit.currency === "IRR" && Number(l.ticket_price_cents) > 0 && (
                        <p className="ltr-nums mt-1 text-xs text-ink-muted">
                          {toman(Number(l.ticket_price_cents))}
                        </p>
                      )}
                    </div>
                    <div className="flex items-end gap-3 pb-1">
                      <label className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <input
                          type="checkbox"
                          checked={!!l.is_active}
                          onChange={(e) => setLevel(i, { is_active: e.target.checked })}
                        />
                        فعال
                      </label>
                      <button
                        type="button"
                        onClick={() => removeLevel(i)}
                        className="text-xs font-bold text-red-600 hover:underline"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {(edit.levels || []).length === 0 && (
                <p className="rounded-xl bg-canvas-alt px-3 py-2 text-xs text-ink-muted">
                  هیچ جایزه‌ای تعریف نشده — مسابقه بدون جایزه قابل خرید نیست.
                </p>
              )}
            </div>

            <p className="mt-3 rounded-xl bg-canvas-alt p-3 text-xs leading-6 text-ink-muted">
              در هر دوره فقط یک برنده وجود دارد و همهٔ شرکت‌کننده‌ها در یک استخر
              واحد رقابت می‌کنند؛ انتخاب جایزه فقط قیمت بلیط و آنچه برنده تحویل
              می‌گیرد را تعیین می‌کند. پس شانس همهٔ سطوح برابر است — اگر قیمت یک
              سطح متناسب با ارزش جایزه‌اش نباشد، عملاً کسی آن را نمی‌خرد.
              «فعال»‌نبودن یعنی سطح دیگر فروخته نمی‌شود، اما بلیط‌های قبلی آن
              معتبر می‌مانند؛ برای همین بهتر است به‌جای حذف، غیرفعالش کنید.
            </p>
          </div>

          <p className="mt-4 rounded-xl bg-canvas-alt p-3 text-xs leading-6 text-ink-muted">
            تصویر تخته باید همان قابی باشد که توپ از آن حذف شده است. پس از باز
            شدن مسابقه، تغییر تصویر مجاز نیست چون پیشنهادهای ثبت‌شده به آن
            وابسته‌اند.
          </p>

          {err && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={save} disabled={busy} className="btn-primary flex-1 !py-2.5 text-sm">
              {busy ? "در حال ذخیره…" : "ذخیره"}
            </button>
            <button onClick={() => setEdit(null)} className="btn-ghost !py-2.5 text-sm">انصراف</button>
          </div>
        </Modal>
      )}
    </>
  );
}
