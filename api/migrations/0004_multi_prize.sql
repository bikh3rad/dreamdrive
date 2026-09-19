-- چند جایزه برای یک مسابقه، و واحد پول ریال.
--
-- مدل: یک مسابقه = یک عکس = یک نقطهٔ نهایی = *یک* برنده. همهٔ شرکت‌کنندگان
-- در یک استخر واحد رقابت می‌کنند، فارغ از اینکه بلیط کدام جایزه را خریده‌اند.
-- انتخاب جایزه یعنی انتخاب قیمت بلیط و اینکه «اگر من آن یک نفر شدم، چه
-- می‌گیرم». پس در هر دوره دقیقاً یک جایزه اهدا می‌شود و بقیه برنده ندارند.
--
-- این تفاوت ظریف ولی تعیین‌کننده است: اگر به‌جای این، هر جایزه استخر جدا
-- داشت، results باید چند ردیفه می‌شد. در این مدل results همان یک ردیف و
-- همان یک برنده می‌ماند و فقط یاد می‌گیرد کدام جایزه اهدا شده است.

-- ---------- ۱) جدول جوایز هر مسابقه ----------
CREATE TABLE IF NOT EXISTS competition_prizes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id     UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    prize_id           UUID NOT NULL REFERENCES prizes(id) ON DELETE RESTRICT,
    -- قیمت بلیط *این سطح*. مرجع قیمت همین‌جاست، نه competitions.
    ticket_price_cents BIGINT NOT NULL CHECK (ticket_price_cents >= 0),
    sort               INT NOT NULL DEFAULT 0,
    -- جایزه‌ای که دیگر فروخته نمی‌شود ولی ردیفش باید بماند، چون ورودی‌های
    -- گذشته به آن اشاره دارند. حذف فیزیکی با ON DELETE RESTRICT جلوگیری شده.
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- یک جایزه دو بار در یک مسابقه معنا ندارد؛ با دو ردیف و دو قیمت، کاربر
    -- می‌توانست ارزان‌ترین را بخرد و گران‌ترین را مطالبه کند.
    UNIQUE (competition_id, prize_id)
);
CREATE INDEX IF NOT EXISTS idx_cprizes_comp
    ON competition_prizes(competition_id, sort);

-- ---------- ۲) انتقال دادهٔ موجود ----------
-- هر مسابقهٔ فعلی یک جایزه و یک قیمت دارد؛ همان را ردیف نخست می‌کنیم تا
-- پایگاه‌داده‌های زنده بدون از دست رفتن داده مهاجرت کنند.
INSERT INTO competition_prizes (competition_id, prize_id, ticket_price_cents, sort)
SELECT c.id, c.prize_id, c.ticket_price_cents, 0
FROM competitions c
WHERE NOT EXISTS (
    SELECT 1 FROM competition_prizes cp WHERE cp.competition_id = c.id
);

-- ---------- ۳) گره خوردن ورودی و قلم سفارش به سطح جایزه ----------
-- NULL موقتاً مجاز است تا ردیف‌های قدیمی پر شوند؛ در پایان NOT NULL می‌شود.
ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS competition_prize_id UUID
    REFERENCES competition_prizes(id) ON DELETE RESTRICT;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS competition_prize_id UUID
    REFERENCES competition_prizes(id) ON DELETE RESTRICT;

UPDATE entries e
   SET competition_prize_id = cp.id
  FROM competition_prizes cp
 WHERE cp.competition_id = e.competition_id
   AND e.competition_prize_id IS NULL;

UPDATE order_items oi
   SET competition_prize_id = cp.id
  FROM competition_prizes cp
 WHERE cp.competition_id = oi.competition_id
   AND oi.competition_prize_id IS NULL;

-- هر ورودی باید بداند برای کدام جایزه خریده شده، وگرنه در زمان تسویه
-- نمی‌دانیم به برنده چه چیزی تعلق می‌گیرد. مسابقه‌ای که هیچ جایزه‌ای ندارد
-- ورودی هم نمی‌تواند داشته باشد، پس این قید همیشه ارضاشدنی است.
ALTER TABLE entries       ALTER COLUMN competition_prize_id SET NOT NULL;
ALTER TABLE order_items   ALTER COLUMN competition_prize_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_cprize ON entries(competition_prize_id);

-- ---------- ۳٫۵) پیوند بلیط↔جایزه تغییرناپذیر است ----------
-- فرمول هشِ ورودی عمداً دست‌نخورده مانده تا زنجیرهٔ پیش از این مهاجرت
-- همچنان قابل راستی‌آزمایی باشد. نتیجه‌اش این است که competition_prize_id
-- زیر چتر هش نیست: کسی با دسترسی به دیتابیس می‌توانست پس از اعلام نتیجه
-- جایزهٔ ورودی برنده را از «سفر شیراز» به «سفر کیش» تغییر دهد و زنجیره
-- همچنان سالم گزارش شود. این تریگر همان شکاف را می‌بندد.
CREATE OR REPLACE FUNCTION entries_prize_immutable() RETURNS trigger AS $$
BEGIN
    IF OLD.competition_prize_id IS DISTINCT FROM NEW.competition_prize_id THEN
        RAISE EXCEPTION 'جایزهٔ یک پیشنهاد ثبت‌شده قابل تغییر نیست';
    END IF;
    IF OLD.competition_id IS DISTINCT FROM NEW.competition_id THEN
        RAISE EXCEPTION 'مسابقهٔ یک پیشنهاد ثبت‌شده قابل تغییر نیست';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_entries_prize_immutable ON entries;
CREATE TRIGGER trg_entries_prize_immutable
    BEFORE UPDATE ON entries
    FOR EACH ROW EXECUTE FUNCTION entries_prize_immutable();

-- ---------- ۴) نتیجه: کدام جایزه اهدا شد ----------
-- از روی ورودیِ برنده خوانده می‌شود، نه محاسبهٔ جدا. NULL یعنی دوره برنده
-- نداشت (هیچ ورودی‌ای ثبت نشده بود).
ALTER TABLE results
    ADD COLUMN IF NOT EXISTS awarded_prize_id UUID
    REFERENCES competition_prizes(id) ON DELETE SET NULL;

UPDATE results r
   SET awarded_prize_id = e.competition_prize_id
  FROM entries e
 WHERE e.id = r.winner_entry_id
   AND r.awarded_prize_id IS NULL;

-- ---------- ۵) بازنشستگی ستون‌های سطح مسابقه ----------
-- حذف نمی‌کنیم چون داده‌های تاریخی و گزارش‌های احتمالی به آن‌ها تکیه دارند،
-- ولی دیگر مرجع نیستند. DEFAULT برداشته می‌شود تا هر کدِ فراموش‌شده‌ای که
-- هنوز روی این ستون‌ها INSERT می‌کند سر و صدا کند به‌جای اینکه بی‌صدا یک
-- قیمت غلط بنویسد.
ALTER TABLE competitions ALTER COLUMN ticket_price_cents DROP DEFAULT;
-- NOT NULL هم برداشته می‌شود، وگرنه کدِ تازه که عمداً این ستون را نمی‌نویسد
-- نمی‌تواند مسابقه بسازد. حالا NULL یعنی «قیمت اینجا نیست، در سطوح است».
ALTER TABLE competitions ALTER COLUMN ticket_price_cents DROP NOT NULL;
COMMENT ON COLUMN competitions.ticket_price_cents IS
    'بازنشسته از مهاجرت 0004 — مرجع قیمت competition_prizes.ticket_price_cents است';
COMMENT ON COLUMN competitions.prize_id IS
    'بازنشسته از مهاجرت 0004 — جوایز در competition_prizes نگهداری می‌شوند';

-- prize_id هنوز NOT NULL است و کد قدیمی ممکن است آن را پر نکند؛ اجازهٔ NULL
-- می‌دهیم تا ساخت مسابقه بدون جایزهٔ پیش‌فرض ممکن باشد.
ALTER TABLE competitions ALTER COLUMN prize_id DROP NOT NULL;

-- ---------- ۶) واحد پول: ریال ----------
-- ریال زیرواحد ندارد. ستون‌ها به دلایل سازگاری هنوز نام _cents دارند ولی
-- از این پس «کمترین واحد پول» را نگه می‌دارند: برای IRR یعنی خودِ ریال، نه
-- صدم آن. تبدیل نمایش در لایهٔ فرانت (تابع money) انجام می‌شود.
--
-- مقادیر موجود عمداً ضرب یا تقسیم نمی‌شوند: نرخ تبدیل یورو به ریال چیزی
-- نیست که یک مهاجرت بتواند حدس بزند. قیمت‌های نمونه در seed بازنویسی
-- می‌شوند و قیمت‌های واقعی باید از پنل ادمین دوباره وارد شوند.
ALTER TABLE competitions ALTER COLUMN currency SET DEFAULT 'IRR';
ALTER TABLE orders       ALTER COLUMN currency SET DEFAULT 'IRR';
UPDATE competitions SET currency='IRR' WHERE currency IN ('EUR','CAD','USD');
UPDATE orders       SET currency='IRR' WHERE currency IN ('EUR','CAD','USD');
