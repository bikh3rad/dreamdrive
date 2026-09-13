"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  api, faNum, ApiError,
  type Competition, type Incident, type JudgeStatus,
  type ChainCheck, type AuditEntry,
} from "@/lib/api";
import { useAuth, isAuditor } from "@/components/AuthProvider";
import { IconShield, IconLock, IconCheck, IconUsers, IconInfo } from "@/components/icons";

const KIND_LABEL: Record<Incident["kind"], string> = {
  chain_broken: "زنجیرهٔ هش شکسته",
  settle_blocked: "تسویه مسدود شد",
  commit_conflict: "تعارض در تعهد داور",
  manual: "گزارش دستی",
};

const STATUS_LABEL: Record<Incident["status"], string> = {
  open: "رسیدگی‌نشده",
  acknowledged: "در حال بررسی",
  resolved: "بسته‌شده",
};

export default function AuditorConsole() {
  const { user, loading } = useAuth();

  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [comps, setComps] = useState<Competition[]>([]);
  const [sel, setSel] = useState<Competition | null>(null);
  const [check, setCheck] = useState<ChainCheck | null>(null);
  const [panel, setPanel] = useState<JudgeStatus[]>([]);
  const [log, setLog] = useState<AuditEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [concern, setConcern] = useState("");
  // خطای بارگذاری باید از «فهرست خالی» جدا بماند. اگر هر دو یک‌شکل نمایش
  // داده شوند، یک خطای ۵۰۰ یا قطعی شبکه روی صفحه‌ای که کارش «خفه‌نشدن» است
  // پیام «همه‌چیز سالم است» تولید می‌کند — بدترین پیش‌فرض ممکن.
  //
  // هر بخش خطای خودش را دارد: با یک متغیر مشترک، خرابیِ لاگ عملیات، فهرست
  // سالم حوادث را هم «نامعلوم» نشان می‌داد و برعکس.
  const [incErr, setIncErr] = useState<string | null>(null);
  const [compErr, setCompErr] = useState<string | null>(null);
  const [logErr, setLogErr] = useState<string | null>(null);

  const loadIncidents = useCallback(async () => {
    try {
      setIncidents((await api.auditor.incidents()).incidents || []);
      setIncErr(null);
    } catch (e) {
      setIncidents(null);
      setIncErr(e instanceof ApiError ? e.message : "ارتباط با سرور برقرار نشد.");
    }
  }, []);

  useEffect(() => {
    if (!isAuditor(user)) return;
    void loadIncidents();
    api.auditor.competitions()
      .then((r) => { setComps(r.competitions || []); setCompErr(null); })
      .catch((e) => setCompErr(e instanceof ApiError ? e.message : "بارگذاری مسابقه‌ها ناموفق بود."));
    api.auditor.audit(60)
      .then((r) => { setLog(r.entries || []); setLogErr(null); })
      .catch((e) => setLogErr(e instanceof ApiError ? e.message : "بارگذاری لاگ ناموفق بود."));
  }, [user, loadIncidents]);

  const open = async (c: Competition) => {
    setSel(c); setCheck(null); setPanel([]); setMsg(null); setConcern("");
    try { setPanel((await api.auditor.panel(c.id)).panel || []); }
    catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "بارگذاری هیئت داوران ناموفق بود." });
    }
  };

  const raise = async () => {
    if (!sel) return;
    const text = concern.trim();
    if (text.length < 20) {
      return setMsg({ kind: "err", text: "توضیح نگرانی باید حداقل ۲۰ نویسه باشد." });
    }
    if (!confirm("این کار تسویهٔ این مسابقه را قفل می‌کند و رکوردش پاک‌شدنی نیست. ادامه؟")) return;
    setBusy(true); setMsg(null);
    try {
      await api.auditor.raise(sel.id, text);
      setConcern("");
      setMsg({ kind: "ok", text: "حادثه ثبت شد و تسویهٔ این مسابقه قفل است." });
      await loadIncidents();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "ثبت حادثه ناموفق بود." });
    } finally { setBusy(false); }
  };

  const verify = async () => {
    if (!sel) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api.auditor.verify(sel.id);
      setCheck(r);
      // اگر بررسی حادثه ساخت، فهرست باید تازه شود وگرنه ناظر ردیف جدید را
      // نمی‌بیند و فکر می‌کند ثبت نشده.
      if (!r.intact) await loadIncidents();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "بررسی ناموفق بود." });
    } finally { setBusy(false); }
  };

  const ack = async (id: number) => {
    setBusy(true); setMsg(null);
    try { await api.auditor.ack(id); await loadIncidents(); }
    catch (e) { setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "ثبت ناموفق بود." }); }
    finally { setBusy(false); }
  };

  const resolve = async (id: number) => {
    const text = (draft[id] || "").trim();
    if (text.length < 20) {
      return setMsg({ kind: "err", text: "توضیح رسیدگی باید حداقل ۲۰ نویسه باشد." });
    }
    if (!confirm("بستن این حادثه قفل تسویه را باز می‌کند و بازگشت‌پذیر نیست. مطمئنی؟")) return;
    setBusy(true); setMsg(null);
    try {
      await api.auditor.resolve(id, text);
      setDraft((d) => ({ ...d, [id]: "" }));
      setMsg({ kind: "ok", text: "حادثه بسته شد و توضیح شما ثبت گردید." });
      await loadIncidents();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof ApiError ? e.message : "بستن حادثه ناموفق بود." });
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-24 text-center text-ink-muted">…</div>;

  if (!user)
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">نظارت مستقل</h1>
        <p className="mt-3 text-sm text-ink-muted">برای دیدن این بخش با حساب ناظر وارد شو.</p>
        <Link href="/login?next=/audit" className="btn-primary mt-6 inline-flex">ورود</Link>
      </div>
    );

  if (!isAuditor(user))
    return (
      <div className="mx-auto max-w-lg px-4 py-24 text-center">
        <h1 className="text-2xl font-black text-ink">این بخش مخصوص ناظر مستقل است</h1>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          این دسترسی حتی به مدیر کل سایت هم داده نمی‌شود. دلیلش ساده است: ناظری
          که زیرمجموعهٔ مدیریت باشد مستقل نیست. برای نظارت باید حساب جداگانه‌ای
          با نقش «ناظر» ساخته شود.
        </p>
      </div>
    );

  const openCount = (incidents || []).filter((i) => i.status !== "resolved").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="eyebrow">نظارت مستقل</p>
      <h1 className="h-section mt-2">حوادث یکپارچگی</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-muted">
        این صفحه فقط-خواندنی است؛ تنها اقدام شما رسیدگی به حادثه است. هیچ
        نقش مدیریتی نمی‌تواند این رکوردها را حذف یا ویرایش کند — این محدودیت
        در خودِ پایگاه‌داده اعمال شده است. تا وقتی حادثه‌ای رسیدگی‌نشده باشد،
        تسویهٔ آن مسابقه قفل است.
      </p>

      {msg && (
        <p className={`mt-6 rounded-xl px-4 py-3 text-sm leading-6 ${
          msg.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
        }`}>{msg.text}</p>
      )}

      {/* ---------- حوادث ---------- */}
      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-black text-ink">
            <IconShield className="h-4 w-4 text-ink-muted" />
            فهرست حوادث
          </h2>
          {incidents !== null && !incErr && (
            <span className={`chip ${openCount > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>
              <span className="ltr-nums">{faNum(openCount)}</span> رسیدگی‌نشده
            </span>
          )}
        </div>

        {incErr ? (
          <div className="card mt-4 border-red-200 bg-red-50 p-6">
            <p className="text-sm font-bold text-red-800">فهرست حوادث بارگذاری نشد</p>
            <p className="mt-2 text-xs leading-6 text-red-800">
              {incErr} — این پیام به‌معنای «حادثه‌ای نیست» نیست؛ یعنی وضعیت
              نامعلوم است. تا روشن‌شدن وضعیت، تسویه نباید انجام شود.
            </p>
            <button onClick={() => void loadIncidents()} className="btn-ghost mt-4 !py-2 !px-4 text-xs">
              تلاش دوباره
            </button>
          </div>
        ) : incidents === null ? (
          <p className="card mt-4 p-10 text-center text-sm text-ink-muted">در حال بارگذاری…</p>
        ) : incidents.length === 0 ? (
          <p className="card mt-4 flex items-start gap-3 p-6 text-sm leading-7 text-ink-soft">
            <IconCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            هیچ حادثه‌ای ثبت نشده است. این یعنی تا این لحظه هیچ بررسی زنجیره‌ای
            به شکست نخورده — نه اینکه بررسی‌ای انجام نشده باشد.
          </p>
        ) : (
          <div className="mt-4 space-y-4">
            {incidents.map((i) => (
              <article key={i.id} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-ink">
                      {KIND_LABEL[i.kind] || i.kind}
                      <span className="ltr-nums ms-2 text-xs font-bold text-ink-muted">#{faNum(i.id)}</span>
                    </h3>
                    <p className="mt-1 text-xs text-ink-muted">
                      {i.competition_title || i.competition_slug}
                    </p>
                  </div>
                  <span className={`chip ${
                    i.status === "open" ? "bg-red-50 text-red-700"
                      : i.status === "acknowledged" ? "bg-brand-50 text-brand-700"
                      : "bg-emerald-50 text-emerald-700"
                  }`}>
                    {STATUS_LABEL[i.status]}
                  </span>
                </div>

                <p className="mt-3 text-sm leading-7 text-ink-soft">{i.detail}</p>

                <dl className="ltr-nums mt-4 grid gap-3 text-xs sm:grid-cols-3">
                  <Cell k="اولین رکورد معیوب" v={`#${faNum(i.first_bad_seq)}`} />
                  <Cell k="رکوردهای سالم پیش از آن" v={faNum(i.checked_count)} />
                  <Cell k="زمان تشخیص" v={new Date(i.detected_at).toLocaleString("fa-IR")} />
                </dl>

                {i.status === "resolved" ? (
                  <div className="mt-4 rounded-xl bg-canvas-alt p-4">
                    <p className="text-xs font-bold text-ink">توضیح رسیدگی</p>
                    <p className="mt-1.5 text-xs leading-6 text-ink-soft">{i.resolution}</p>
                    {i.resolved_at && (
                      <p className="mt-2 text-[11px] text-ink-muted">
                        بسته‌شده در {new Date(i.resolved_at).toLocaleString("fa-IR")}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {i.status === "open" && (
                      <button onClick={() => ack(i.id)} disabled={busy} className="btn-ghost !py-2 !px-4 text-xs">
                        <IconInfo className="h-4 w-4" />
                        دیدم، در حال بررسی‌ام
                      </button>
                    )}
                    <textarea
                      value={draft[i.id] || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, [i.id]: e.target.value }))}
                      rows={3}
                      placeholder="توضیح بده چه بررسی‌ای کردی و چرا این حادثه قابل بستن است. این متن ثبت دائمی می‌شود."
                      className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs leading-6 text-ink placeholder:text-ink-muted/70"
                    />
                    <button onClick={() => resolve(i.id)} disabled={busy} className="btn-dark !py-2 !px-4 text-xs">
                      <IconLock className="h-4 w-4" />
                      بستن حادثه و باز کردن قفل تسویه
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ---------- بررسی مستقل ---------- */}
      <section className="mt-14">
        <h2 className="text-sm font-black text-ink">بررسی مستقل زنجیره</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-ink-muted">
          نتیجهٔ این بررسی را خودتان محاسبه می‌کنید و به گزارش مدیریت وابسته
          نیست. اگر زنجیره معیوب باشد، همین‌جا یک حادثه ثبت می‌شود.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[300px_1fr]">
          <div className="card divide-y divide-ink/[.05]">
            {compErr ? (
              <p className="p-8 text-center text-xs leading-6 text-red-800">
                {compErr} — فهرست مسابقه‌ها نامعلوم است، نه خالی.
              </p>
            ) : comps.length === 0 ? (
              <p className="p-8 text-center text-xs text-ink-muted">مسابقه‌ای وجود ندارد.</p>
            ) : null}
            {comps.map((c) => (
              <button
                key={c.id}
                onClick={() => open(c)}
                className={`block w-full px-4 py-3 text-start hover:bg-canvas-alt/40 ${
                  sel?.id === c.id ? "bg-brand-50" : ""
                }`}
              >
                <p className="text-sm font-bold text-ink">{c.prize?.title || c.title}</p>
                <p className="ltr-nums mt-0.5 text-xs text-ink-muted">{c.slug} · {c.status}</p>
              </button>
            ))}
          </div>

          {!sel ? (
            <div className="card flex items-center justify-center p-14 text-sm text-ink-muted">
              یک مسابقه انتخاب کن.
            </div>
          ) : (
            <div className="space-y-5">
              <div className="card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-ink">زنجیرهٔ هش پیشنهادها</h3>
                  <button onClick={verify} disabled={busy} className="btn-ghost !py-2 !px-4 text-xs">
                    اجرای بررسی
                  </button>
                </div>
                {check && (
                  <div className={`mt-4 rounded-xl p-4 text-sm leading-6 ${
                    check.intact ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
                  }`}>
                    {check.intact ? (
                      <>زنجیره سالم است — <span className="ltr-nums font-bold">{faNum(check.checked)}</span> رکورد بررسی شد.</>
                    ) : (
                      <>
                        زنجیره شکسته است. اولین رکورد مشکوک{" "}
                        <span className="ltr-nums font-bold">#{faNum(check.first_bad_seq)}</span> است.
                        حادثه ثبت شد و تسویهٔ این مسابقه تا رسیدگی شما قفل است.
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* ثبت نگرانی مستقل */}
              <div className="card p-6">
                <h3 className="text-sm font-black text-ink">توقف تسویه به تشخیص خودم</h3>
                <p className="mt-2 text-xs leading-6 text-ink-muted">
                  اگر به چیزی جز شکستن زنجیره مشکوکی — الگوی مشکوک در تعهد
                  داوران، خبری از بیرون، هر چیز دیگر — می‌توانی همین‌جا حادثه
                  ثبت کنی. تسویه قفل می‌شود و این متن پاک‌شدنی نیست.
                </p>
                <textarea
                  value={concern}
                  onChange={(e) => setConcern(e.target.value)}
                  rows={3}
                  placeholder="چه چیزی دیدی و چرا تسویه باید متوقف شود؟"
                  className="mt-3 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs leading-6 text-ink placeholder:text-ink-muted/70"
                />
                <button onClick={raise} disabled={busy} className="btn-dark mt-3 !py-2 !px-4 text-xs">
                  <IconLock className="h-4 w-4" />
                  ثبت حادثه و قفل تسویه
                </button>
              </div>

              <div className="card p-6">
                <h3 className="flex items-center gap-2 text-sm font-black text-ink">
                  <IconUsers className="h-4 w-4 text-ink-muted" />
                  وضعیت هیئت داوران
                </h3>
                {panel.length === 0 ? (
                  <p className="mt-3 text-xs text-ink-muted">داوری ثبت نشده است.</p>
                ) : (
                  <div className="mt-3 divide-y divide-ink/[.05]">
                    {panel.map((j) => (
                      <div key={j.judge_id} className="flex items-center gap-3 py-2.5 text-sm">
                        <span className="flex-1 font-bold text-ink">{j.display_name}</span>
                        <span className={`chip ${j.committed ? "bg-emerald-50 text-emerald-700" : "bg-canvas-alt text-ink-muted"}`}>
                          {j.committed ? "قفل‌شده" : "بدون تعهد"}
                        </span>
                        <span className={`chip ${j.revealed ? "bg-brand-50 text-brand-700" : "bg-canvas-alt text-ink-muted"}`}>
                          {j.revealed ? `${j.x?.toFixed(4)} , ${j.y?.toFixed(4)}` : "افشا نشده"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---------- لاگ عملیات ---------- */}
      <section className="mt-14">
        <h2 className="text-sm font-black text-ink">لاگ عملیات مدیریتی</h2>
        <p className="mt-2 max-w-2xl text-xs leading-6 text-ink-muted">
          آخرین اقدام‌های ثبت‌شده. برای نظارت لازم است ببینید چه کسی چه تغییری
          داده است، نه فقط نتیجهٔ نهایی را.
        </p>
        <div className="card mt-4 divide-y divide-ink/[.05]">
          {logErr ? (
            <p className="p-8 text-center text-xs leading-6 text-red-800">
              {logErr} — لاگ بارگذاری نشد. خالی‌بودن این بخش را به‌معنای
              «اقدامی ثبت نشده» نگیرید.
            </p>
          ) : log.length === 0 ? (
            <p className="p-8 text-center text-xs text-ink-muted">رکوردی نیست.</p>
          ) : null}
          {log.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-xs">
              <span className="ltr-nums font-bold text-ink">{e.action}</span>
              <span className="text-ink-muted">{e.actor_email || "—"}</span>
              <span className="ltr-nums ms-auto text-ink-muted">
                {new Date(e.created_at).toLocaleString("fa-IR")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Cell({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-xl bg-canvas-alt px-3 py-2.5">
      <dt className="text-[11px] text-ink-muted">{k}</dt>
      <dd className="mt-0.5 font-bold text-ink">{v}</dd>
    </div>
  );
}
