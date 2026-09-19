-- یکپارچگی سطوح جایزه و تثبیت بهای پرداخت‌شده.
--
-- توجه ۱: ستون entry_target عمداً اینجا نیست و به 0006 منتقل شده. دلیلش در
-- ابتدای همان فایل توضیح داده شده است.
--
-- توجه ۲: نام فایل («entry_target») به همان دلیل دیگر با محتوایش نمی‌خواند،
-- و عمداً تغییر نکرده: نام فایل کلیدِ schema_migrations است و تغییرش یعنی
-- اجرای دوبارهٔ همین فایل روی پایگاه داده‌ای که قبلاً آن را اجرا کرده.

-- ---------- ۱) سطح جایزه نمی‌تواند به مسابقهٔ دیگری تعلق داشته باشد ----------
-- تا اینجا entries.competition_prize_id و entries.competition_id دو کلید
-- خارجیِ مستقل بودند: هیچ چیز در پایگاه داده مانع نمی‌شد که یک ورودی به
-- مسابقهٔ الف و به سطح جایزهٔ مسابقهٔ ب اشاره کند. سرور این را اجازه نمی‌دهد
-- (competition_id از خودِ سطح گرفته می‌شود)، ولی یک اسکریپت دستی یا باگ
-- آینده می‌تواند. اینجا همان قاعده را در سطح پایگاه داده قفل می‌کنیم چون
-- نتیجهٔ نقضش «اهدای جایزهٔ یک مسابقه به برندهٔ مسابقهٔ دیگر» است.
DO $$ BEGIN
    ALTER TABLE competition_prizes
        ADD CONSTRAINT uq_cprize_id_comp UNIQUE (id, competition_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- order_items نه زیر هش است و نه تریگر تغییرناپذیری دارد، پس ردیف ناسازگار
-- را می‌شود بی‌خطر ترمیم کرد.
UPDATE order_items oi
SET competition_id = cp.competition_id
FROM competition_prizes cp
WHERE cp.id = oi.competition_prize_id
  AND oi.competition_id <> cp.competition_id;

-- entries اما عمداً ترمیم *نمی‌شود*. دو دلیل، هر کدام به‌تنهایی کافی:
--
--   ۱) تریگر trg_entries_prize_immutable (مهاجرت ۰۰۰۴) دقیقاً روی همین
--      تغییر RAISE EXCEPTION می‌دهد. یعنی UPDATE ترمیمی روی پایگاه دادهٔ
--      تمیز بی‌صدا صفر ردیف می‌گرفت و روی پایگاه دادهٔ ناسازگار — همان‌جا که
--      قرار بود کار کند — کل مهاجرت را برمی‌گرداند و سرور برای همیشه در
--      log.Fatalf بوت می‌ماند.
--   ۲) competition_id داخل فرمول EntryHash است. بازنویسی‌اش هشِ ذخیره‌شده را
--      غیرقابل بازتولید می‌کند؛ VerifyEntryChain زنجیره را شکسته اعلام
--      می‌کند، Settle حادثهٔ chain_broken ثبت می‌کند و دوره تا رسیدگی ناظر
--      غیرقابل تسویه می‌شود. مهاجرتی که برای حفظ یکپارچگی، حادثهٔ یکپارچگی
--      می‌سازد بدتر از کاری‌نکردن است.
--
-- پس کلید خارجی NOT VALID اضافه می‌شود: از این لحظه هر درج و به‌روزرسانی
-- تازه بررسی می‌شود، ولی ردیف‌های تاریخی دست‌نخورده و قابل‌راستی‌آزمایی
-- می‌مانند. اگر روزی ناسازگاری تاریخی وجود داشت، ناظر باید آن را به‌عنوان
-- حادثه ببیند — نه اینکه یک مهاجرت بی‌سروصدا رویش را بپوشاند.
DO $$ BEGIN
    ALTER TABLE entries
        ADD CONSTRAINT fk_entry_cprize_same_comp
        FOREIGN KEY (competition_prize_id, competition_id)
        REFERENCES competition_prizes(id, competition_id)
        NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE order_items
        ADD CONSTRAINT fk_oi_cprize_same_comp
        FOREIGN KEY (competition_prize_id, competition_id)
        REFERENCES competition_prizes(id, competition_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- ۳) بازنشسته کردن قیمت‌های بازماندهٔ دورهٔ یورو ----------
-- مهاجرت ۰۰۰۴ قیمت‌ها را عیناً منتقل کرد. روی یک پایگاه دادهٔ زنده یعنی
-- سطحی با قیمت ۲۰۰ (سنت یورو) حالا ۲۰۰ ریال فروخته می‌شود — عملاً رایگان.
-- به‌جای ضرب حدسی در نرخ تبدیل، این سطوح را غیرفعال می‌کنیم تا ادمین قیمت
-- واقعی را خودش بگذارد. ورودی‌های گذشته دست‌نخورده می‌مانند.
UPDATE competition_prizes cp
SET is_active = FALSE
FROM competitions c
WHERE c.id = cp.competition_id
  AND cp.is_active
  AND cp.ticket_price_cents > 0
  AND cp.ticket_price_cents < 100000;   -- کمتر از ۱۰٬۰۰۰ تومان: قیمت واقعی نیست

-- ---------- ۴) ثبت بهای پرداخت‌شدهٔ هر ورودی ----------
-- پاداش نزدیک‌ترین حدس (judging.go) بهای بلیط را از قیمت *امروزِ* سطح
-- می‌خواند. اگر ادمین قیمت را بین ثبت حدس و تسویه عوض کند، پاداش بر اساس
-- عددی محاسبه می‌شود که کاربر هرگز نپرداخته است. بهای واقعی را همین‌جا
-- تثبیت می‌کنیم.
ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS paid_price_cents BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN entries.paid_price_cents IS
    'بهای واقعاً پرداخت‌شدهٔ این حدس در لحظهٔ ثبت؛ ورود رایگان = ۰';

-- پر کردن گذشته از روی سطرهای سفارش. ورودی رایگان order_id ندارد و روی ۰
-- می‌ماند، که همان مقدار درست است.
UPDATE entries e
SET paid_price_cents = oi.unit_price_cents
FROM order_items oi
WHERE oi.order_id = e.order_id
  AND oi.competition_prize_id = e.competition_prize_id
  AND e.paid_price_cents = 0
  AND e.order_id IS NOT NULL;

-- زیرپرس‌وجوی درآمدِ هر مسابقه در پنل ادمین روی این ایندکس می‌نشیند.
CREATE INDEX IF NOT EXISTS idx_oi_comp ON order_items(competition_id);
