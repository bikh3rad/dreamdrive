-- نقش «ناظر مستقل» و ثبت تغییرناپذیر حوادث یکپارچگی.
--
-- انگیزه: پیش از این، شکستن زنجیرهٔ هش فقط یک پیام روی صفحهٔ ادمین بود.
-- یعنی تنها کسی که از حادثه باخبر می‌شد همان کسی بود که بیشترین انگیزه را
-- برای پنهان کردنش دارد. این مهاجرت حادثه را به رکوردی تبدیل می‌کند که
-- حتی با دسترسی کامل برنامه هم قابل حذف یا دستکاری نیست، و تسویه را تا
-- رسیدگیِ ناظر قفل می‌کند.

-- ---------- ۱) نقش auditor ----------
-- نام قید در 0001 صریح تعیین نشده بود، پس نام پیش‌فرض پستگرس را هدف
-- می‌گیریم. IF EXISTS لازم است چون ممکن است پایگاه‌داده دستی اصلاح شده باشد.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('user','support','content_admin','finance_admin',
                    'superadmin','judge','auditor'));

-- ---------- ۲) جدول حوادث ----------
CREATE TABLE IF NOT EXISTS integrity_incidents (
    id             BIGSERIAL PRIMARY KEY,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
    kind           TEXT NOT NULL
                   CHECK (kind IN ('chain_broken','settle_blocked','commit_conflict','manual')),
    detail         TEXT NOT NULL DEFAULT '',
    -- برای chain_broken: اولین seq معیوب و تعداد رکوردهای سالمِ پیش از آن
    first_bad_seq  BIGINT NOT NULL DEFAULT 0,
    checked_count  BIGINT NOT NULL DEFAULT 0,
    detected_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- چرخهٔ رسیدگی؛ فقط ناظر مستقل آن را جلو می‌برد
    status         TEXT NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','acknowledged','resolved')),
    ack_by         UUID REFERENCES users(id) ON DELETE SET NULL,
    ack_at         TIMESTAMPTZ,
    resolution     TEXT NOT NULL DEFAULT '',
    resolved_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incidents_comp ON integrity_incidents(competition_id);

-- یک حادثهٔ بازِ chain_broken برای هر مسابقه کافی است؛ بدون این قید هر بار
-- زدن دکمهٔ «اجرای بررسی» یک ردیف تکراری می‌ساخت و جدول ناظر بی‌استفاده
-- می‌شد. شرط جزئی باعث می‌شود پس از resolve، حادثهٔ جدید بتواند ثبت شود.
-- 0003 این ایندکس را محدود می‌کند تا شامل kind='manual' نشود.
CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_open_kind
    ON integrity_incidents(competition_id, kind) WHERE status <> 'resolved';

-- ---------- ۳) تغییرناپذیری ----------
-- برنامه با یک کاربر پایگاه‌داده کار می‌کند، پس GRANT کمکی نمی‌کند؛
-- تریگر تنها راهی است که حتی یک باگ یا کوئری دستیِ عمدی در خودِ برنامه هم
-- نتواند رد حادثه را پاک کند.
CREATE OR REPLACE FUNCTION integrity_incidents_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'integrity incidents are append-only and cannot be deleted';
    END IF;

    -- فیلدهای واقعیتِ حادثه ثابت‌اند. فقط ستون‌های چرخهٔ رسیدگی قابل
    -- تغییرند، وگرنه ادمین می‌توانست first_bad_seq را صفر کند و حادثه را
    -- بی‌اثر جلوه دهد.
    IF NEW.competition_id <> OLD.competition_id
       OR NEW.kind          <> OLD.kind
       OR NEW.detail        <> OLD.detail
       OR NEW.first_bad_seq <> OLD.first_bad_seq
       OR NEW.checked_count <> OLD.checked_count
       OR NEW.detected_at   <> OLD.detected_at THEN
        RAISE EXCEPTION 'incident facts are immutable; only the triage fields may change';
    END IF;

    -- رسیدگی یک‌طرفه است: open → acknowledged → resolved، بی‌بازگشت.
    IF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
        RAISE EXCEPTION 'a resolved incident cannot be reopened';
    END IF;

    -- توجه: بررسیِ «فقط حساب auditor می‌تواند حادثه را ببندد» در مهاجرت
    -- 0003 به این تابع اضافه می‌شود، نه اینجا. این فایل ممکن است روی
    -- پایگاه‌داده‌های موجود قبلاً اجرا شده باشد و دوباره اجرا نمی‌شود.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incidents_append_only ON integrity_incidents;
CREATE TRIGGER trg_incidents_append_only
    BEFORE UPDATE OR DELETE ON integrity_incidents
    FOR EACH ROW EXECUTE FUNCTION integrity_incidents_append_only();
