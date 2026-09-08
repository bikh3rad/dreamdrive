"use client";

import { useEffect, useState } from "react";
import { api, money, ApiError, type Prize } from "@/lib/api";
import { PageHead, Table, Empty, Modal } from "@/components/admin/ui";

const BLANK: Partial<Prize> = {
  slug: "", title: "", kind: "villa_car", subtitle: "", body_md: "",
  value_cents: 0, hero_image: "",
};

/**
 * سرور فیلدهای ناشناخته را رد می‌کند، پس هنگام ذخیره فقط همان کلیدهایی را
 * می‌فرستیم که PrizeInput می‌پذیرد — نه id، created_at یا media.
 */
function payload(p: Partial<Prize>) {
  return {
    slug: p.slug || "",
    title: p.title || "",
    kind: p.kind || "villa_car",
    subtitle: p.subtitle || "",
    body_md: p.body_md || "",
    spec: p.spec || {},
    value_cents: p.value_cents ?? 0,
    hero_image: p.hero_image || "",
  };
}

export default function PrizesPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [edit, setEdit] = useState<Partial<Prize> | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.prizes().then((r) => setPrizes(r.prizes || [])).catch(() => {});
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr("");
    try {
      if (edit.id) await api.admin.updatePrize(edit.id, payload(edit));
      else await api.admin.createPrize(payload(edit));
      setEdit(null);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ذخیره ناموفق بود.");
    } finally { setBusy(false); }
  };

  const remove = async (p: Prize) => {
    if (!confirm(`حذف «${p.title}»؟ اگر مسابقه‌ای به آن وصل باشد حذف نمی‌شود.`)) return;
    try { await api.admin.deletePrize(p.id); await load(); }
    catch (e) { alert(e instanceof ApiError ? e.message : "حذف ناموفق بود."); }
  };

  const set = (k: keyof Prize) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEdit((p) => ({ ...p!, [k]: k === "value_cents" ? Number(e.target.value) * 100 : e.target.value }));

  return (
    <>
      <PageHead
        title="جایزه‌ها"
        subtitle="هر مسابقه به یک جایزه وصل می‌شود: ویلا، خودرو یا ترکیب هر دو. تصویر شاخص در کارت‌ها و صفحهٔ اصلی استفاده می‌شود."
        action={
          <button onClick={() => setEdit({ ...BLANK })} className="btn-primary !py-2.5 text-sm">
            جایزهٔ جدید
          </button>
        }
      />

      <Table head={["", "عنوان", "نوع", "ارزش", "شناسه", ""]}>
        {prizes.length === 0 && <Empty>هنوز جایزه‌ای ثبت نشده است.</Empty>}
        {prizes.map((p) => (
          <tr key={p.id} className="hover:bg-canvas-alt/40">
            <td className="px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.hero_image} alt="" className="h-11 w-16 rounded-lg object-cover" />
            </td>
            <td className="px-4 py-3">
              <p className="font-bold text-ink">{p.title}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{p.subtitle}</p>
            </td>
            <td className="px-4 py-3 text-ink-soft">{p.kind}</td>
            <td className="ltr-nums px-4 py-3 text-ink-soft">{money(p.value_cents)}</td>
            <td className="ltr-nums px-4 py-3 text-xs text-ink-muted">{p.slug}</td>
            <td className="whitespace-nowrap px-4 py-3 text-end">
              <button onClick={() => setEdit(p)} className="text-xs font-bold text-brand-600 hover:underline">ویرایش</button>
              <button onClick={() => remove(p)} className="ms-4 text-xs font-bold text-red-600 hover:underline">حذف</button>
            </td>
          </tr>
        ))}
      </Table>

      {edit && (
        <Modal title={edit.id ? "ویرایش جایزه" : "جایزهٔ جدید"} onClose={() => setEdit(null)} wide>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">عنوان</label>
              <input className="field" value={edit.title || ""} onChange={set("title")} />
            </div>
            <div>
              <label className="label">شناسهٔ نشانی (slug)</label>
              <input className="field text-start" dir="ltr" value={edit.slug || ""} onChange={set("slug")} />
            </div>
            <div>
              <label className="label">نوع</label>
              <select className="field" value={edit.kind} onChange={set("kind")}>
                <option value="villa_car">ویلا + خودرو</option>
                <option value="car">فقط خودرو</option>
                <option value="villa">فقط اقامت</option>
                <option value="cash">جایزهٔ نقدی</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">توضیح کوتاه</label>
              <input className="field" value={edit.subtitle || ""} onChange={set("subtitle")} />
            </div>
            <div>
              <label className="label">ارزش (به واحد اصلی، نه سنت)</label>
              <input
                className="field text-start" dir="ltr" type="number"
                value={(edit.value_cents ?? 0) / 100}
                onChange={set("value_cents")}
              />
            </div>
            <div>
              <label className="label">نشانی تصویر شاخص</label>
              <input className="field text-start" dir="ltr" value={edit.hero_image || ""} onChange={set("hero_image")} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">توضیح کامل (مارک‌داون)</label>
              <textarea className="field min-h-[9rem]" value={edit.body_md || ""} onChange={set("body_md")} />
            </div>
          </div>

          {edit.hero_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={edit.hero_image} alt="" className="mt-4 aspect-[16/7] w-full rounded-xl object-cover" />
          )}

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
