"use client";

import { useEffect, useState } from "react";
import { api, faNum, money, ApiError, type Competition, type Prize } from "@/lib/api";
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

  const load = () => api.admin.competitions().then((r) => setComps(r.competitions || [])).catch(() => {});
  useEffect(() => {
    void load();
    api.admin.prizes().then((r) => setPrizes(r.prizes || [])).catch(() => {});
  }, []);

  const blank = () => ({
    slug: "", title: "", prize_id: prizes[0]?.id || "",
    ticket_price_cents: 300, currency: "CAD", board_image: "",
    opens_at: new Date().toISOString(),
    closes_at: new Date(Date.now() + 7 * 86400000).toISOString(),
    max_entries_user: 100, status: "draft",
  });

  const save = async () => {
    setBusy(true); setErr("");
    try {
      // فقط کلیدهای CompetitionInput؛ سرور فیلدهای اضافی (id، prize، …) را رد می‌کند.
      const body = {
        slug: edit.slug || "",
        prize_id: edit.prize_id,
        title: edit.title || "",
        currency: edit.currency || "CAD",
        board_image: edit.board_image || "",
        status: edit.status || "draft",
        opens_at: new Date(edit.opens_at).toISOString(),
        closes_at: new Date(edit.closes_at).toISOString(),
        ticket_price_cents: Number(edit.ticket_price_cents),
        max_entries_user: Number(edit.max_entries_user),
      };
      if (edit.id) await api.admin.updateCompetition(edit.id, body);
      else await api.admin.createCompetition(body);
      setEdit(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ذخیره ناموفق بود.");
    } finally { setBusy(false); }
  };

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

      <Table head={["عنوان", "وضعیت", "قیمت", "بازه", "سقف", "شرکت", "اقدام"]}>
        {comps.length === 0 && <Empty>هنوز مسابقه‌ای ساخته نشده است.</Empty>}
        {comps.map((c) => (
          <tr key={c.id} className="hover:bg-canvas-alt/40">
            <td className="px-4 py-3">
              <p className="font-bold text-ink">{c.prize?.title || c.title}</p>
              <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{c.slug}</p>
            </td>
            <td className="px-4 py-3"><Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge></td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{money(c.ticket_price_cents, c.currency)}</td>
            <td className="px-4 py-3 text-xs text-ink-soft">
              {new Date(c.opens_at).toLocaleDateString("fa-IR")} –{" "}
              {new Date(c.closes_at).toLocaleDateString("fa-IR")}
            </td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{faNum(c.max_entries_user)}</td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{faNum(c.entry_count ?? 0)}</td>
            <td className="whitespace-nowrap px-4 py-3 text-end">
              <button
                onClick={() => setEdit({ ...c, opens_at: toLocalInput(c.opens_at), closes_at: toLocalInput(c.closes_at) })}
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
              <label className="label">جایزه</label>
              <select className="field" value={edit.prize_id} onChange={set("prize_id")}>
                {prizes.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label">قیمت هر پیشنهاد (سنت)</label>
              <input className="field text-start" dir="ltr" type="number" value={edit.ticket_price_cents} onChange={set("ticket_price_cents")} />
            </div>
            <div>
              <label className="label">واحد پول</label>
              <select className="field" value={edit.currency} onChange={set("currency")}>
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
            </div>
            <div>
              <label className="label">سقف پیشنهاد هر کاربر</label>
              <input className="field text-start" dir="ltr" type="number" value={edit.max_entries_user} onChange={set("max_entries_user")} />
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
