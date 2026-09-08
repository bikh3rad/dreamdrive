"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import { PageHead, Table, Empty, Badge } from "@/components/admin/ui";
import { Markdown } from "@/components/Markdown";

interface CmsPage {
  slug: string;
  title: string;
  body_md: string;
  published: boolean;
  updated_at?: string;
}

const BLANK: CmsPage = { slug: "", title: "", body_md: "", published: false };

export default function AdminPagesPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [edit, setEdit] = useState<CmsPage | null>(null);
  const [preview, setPreview] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api.admin.pages().then((r) => setPages(r.pages || [])).catch(() => {});
  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!edit) return;
    setBusy(true); setErr("");
    try {
      await api.admin.savePage(edit);
      await load();
      setErr("");
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "ذخیره ناموفق بود.");
    } finally { setBusy(false); }
  };

  return (
    <>
      <PageHead
        title="صفحه‌ها"
        subtitle="متن صفحه‌های ثابت سایت: شرایط استفاده، قوانین مسابقه، حریم خصوصی، بازی مسئولانه و هر صفحهٔ دیگری که لازم داری."
        action={
          <button onClick={() => { setEdit({ ...BLANK }); setPreview(false); }} className="btn-primary !py-2.5 text-sm">
            صفحهٔ جدید
          </button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
        <div>
          <Table head={["عنوان", "وضعیت"]}>
            {pages.length === 0 && <Empty>صفحه‌ای وجود ندارد.</Empty>}
            {pages.map((p) => (
              <tr
                key={p.slug}
                onClick={() => { setEdit(p); setPreview(false); }}
                className={`cursor-pointer hover:bg-canvas-alt/40 ${edit?.slug === p.slug ? "bg-brand-50" : ""}`}
              >
                <td className="px-4 py-3">
                  <p className="font-bold text-ink">{p.title}</p>
                  <p className="ltr-nums mt-0.5 text-xs text-ink-muted">/{p.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <Badge tone={p.published ? "ok" : "mute"}>
                    {p.published ? "منتشرشده" : "پیش‌نویس"}
                  </Badge>
                </td>
              </tr>
            ))}
          </Table>
        </div>

        {edit ? (
          <div className="card p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">عنوان</label>
                <input
                  className="field" value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </div>
              <div>
                <label className="label">شناسهٔ نشانی</label>
                <input
                  className="field text-start" dir="ltr" value={edit.slug}
                  onChange={(e) => setEdit({ ...edit, slug: e.target.value })}
                />
                <p className="ltr-nums mt-1.5 text-xs text-ink-muted">/legal/{edit.slug || "…"}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <label className="label mb-0">متن (مارک‌داون)</label>
              <div className="flex gap-1 rounded-full bg-canvas-alt p-1">
                {[["ویرایش", false], ["پیش‌نمایش", true]].map(([l, v]) => (
                  <button
                    key={String(v)}
                    onClick={() => setPreview(v as boolean)}
                    className={`rounded-full px-3.5 py-1 text-xs font-bold transition ${
                      preview === v ? "bg-white text-ink shadow-sm" : "text-ink-muted"
                    }`}
                  >
                    {l as string}
                  </button>
                ))}
              </div>
            </div>

            {preview ? (
              <div className="mt-2 min-h-[24rem] rounded-xl border border-ink/10 bg-white p-5">
                <Markdown source={edit.body_md} />
              </div>
            ) : (
              <textarea
                className="field mt-2 min-h-[24rem] font-mono text-xs leading-6"
                value={edit.body_md}
                onChange={(e) => setEdit({ ...edit, body_md: e.target.value })}
              />
            )}

            <label className="mt-4 flex items-center gap-2.5 text-sm text-ink-soft">
              <input
                type="checkbox" className="h-4 w-4 accent-[#F0A828]"
                checked={edit.published}
                onChange={(e) => setEdit({ ...edit, published: e.target.checked })}
              />
              منتشر شود (برای بازدیدکنندگان قابل مشاهده باشد)
            </label>

            {err && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>}

            <div className="mt-5 flex gap-3">
              <button onClick={save} disabled={busy} className="btn-primary !py-2.5 text-sm">
                {busy ? "در حال ذخیره…" : "ذخیره"}
              </button>
              <button onClick={() => setEdit(null)} className="btn-ghost !py-2.5 text-sm">بستن</button>
            </div>
          </div>
        ) : (
          <div className="card flex items-center justify-center p-16 text-sm text-ink-muted">
            یک صفحه را از فهرست انتخاب کن یا صفحهٔ جدیدی بساز.
          </div>
        )}
      </div>
    </>
  );
}
