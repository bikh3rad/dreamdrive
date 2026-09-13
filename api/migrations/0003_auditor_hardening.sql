-- سخت‌سازی نظارت مستقل، پس از بازبینی 0002.
--
-- چرا مهاجرت جدید و نه ویرایش 0002؟ Migrate هر فایل را فقط یک بار اجرا
-- می‌کند (جدول schema_migrations). هر تغییری در 0002 روی پایگاه‌داده‌ای که
-- قبلاً آن را اجرا کرده بی‌اثر است — یعنی کد تضمینی را ادعا می‌کرد که در
-- دیتابیس نصب نشده بود. بدترین نوع حفرهٔ امنیتی: روی کاغذ بسته، در عمل باز.

-- ---------- ۱) بستن حادثه فقط به‌دست ناظر ----------
-- تریگر 0002 حذف و دستکاری فاکت‌ها را می‌بست، ولی *چه کسی* می‌تواند حادثه
-- را resolve کند را محدود نمی‌کرد. یک UPDATE دستی با هر UUID دلخواهی قفل
-- تسویه را باز می‌کرد و گیت سمت برنامه (RequireExactRole) دور زده می‌شد.
CREATE OR REPLACE FUNCTION integrity_incidents_append_only()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'integrity incidents are append-only and cannot be deleted';
    END IF;

    IF NEW.competition_id <> OLD.competition_id
       OR NEW.kind          <> OLD.kind
       OR NEW.detail        <> OLD.detail
       OR NEW.first_bad_seq <> OLD.first_bad_seq
       OR NEW.checked_count <> OLD.checked_count
       OR NEW.detected_at   <> OLD.detected_at THEN
        RAISE EXCEPTION 'incident facts are immutable; only the triage fields may change';
    END IF;

    IF OLD.status = 'resolved' AND NEW.status <> 'resolved' THEN
        RAISE EXCEPTION 'a resolved incident cannot be reopened';
    END IF;

    -- بستن حادثه = باز شدن قفل تسویه. پس همین‌جا، در پایین‌ترین لایه، بررسی
    -- می‌کنیم که به‌نام حسابی با نقش auditor ثبت شده و توضیح مکتوب دارد.
    IF NEW.status = 'resolved' AND OLD.status <> 'resolved' THEN
        IF NEW.resolved_by IS NULL
           OR NOT EXISTS (SELECT 1 FROM users
                           WHERE id = NEW.resolved_by AND role = 'auditor') THEN
            RAISE EXCEPTION 'only an account with the auditor role can resolve an integrity incident';
        END IF;
        IF length(btrim(NEW.resolution)) < 20 THEN
            RAISE EXCEPTION 'resolving an incident requires a written explanation';
        END IF;
    END IF;

    -- نسبت دادن رسیدگی به حسابی که ناظر نیست هم پذیرفته نمی‌شود.
    -- شرط IS DISTINCT FROM لازم است: ResolveIncident به ack_by دست نمی‌زند و
    -- نباید در این شاخه بیفتد. ON DELETE SET NULL هم با IS NOT NULL رد می‌شود.
    IF NEW.ack_by IS NOT NULL AND NEW.ack_by IS DISTINCT FROM OLD.ack_by
       AND NOT EXISTS (SELECT 1 FROM users
                        WHERE id = NEW.ack_by AND role = 'auditor') THEN
        RAISE EXCEPTION 'only an account with the auditor role can triage an integrity incident';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- تریگر به نام تابع اشاره می‌کند، پس CREATE OR REPLACE کافی است و نیازی به
-- ساختن دوبارهٔ تریگر نیست. برای پایگاه‌داده‌های تازه هم بی‌خطر است.

-- ---------- ۲) ایندکس یکتا شامل حوادث دستی نشود ----------
-- uq_incident_open_kind روی (competition_id, kind) بود، یعنی فقط یک حادثهٔ
-- manual باز در هر مسابقه ممکن بود. نتیجه: نگرانیِ دومِ ناظر با
-- ON CONFLICT DO NOTHING بی‌صدا دور ریخته می‌شد، در حالی که رابط کاربری به
-- او گفته بود «این متن پاک‌شدنی نیست». دوباره‌نشدن برای chain_broken لازم
-- است (دکمهٔ بررسی ممکن است چند بار زده شود) ولی برای manual غلط است:
-- هر نگرانی ناظر یک واقعیت جداگانه است.
DROP INDEX IF EXISTS uq_incident_open_kind;
CREATE UNIQUE INDEX IF NOT EXISTS uq_incident_open_kind
    ON integrity_incidents(competition_id, kind)
    WHERE status <> 'resolved' AND kind <> 'manual';

-- ---------- ۳) ایندکس زائد ----------
-- با uq_incident_open_kind که هم روی competition_id پیشرو است و هم همان
-- شرط جزئی را دارد، این ایندکس کار اضافه‌ای نمی‌کرد.
DROP INDEX IF EXISTS idx_incidents_open;
