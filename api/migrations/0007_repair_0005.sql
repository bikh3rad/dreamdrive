-- ترمیم پایگاه‌داده‌هایی که نسخهٔ میانیِ ۰۰۰۵ را اجرا کرده‌اند.
--
-- چه اتفاقی افتاد: ۰۰۰۵ ابتدا فقط entry_target را داشت و با همان نام در
-- schema_migrations ثبت شد. بعد محتوایش عوض شد (entry_target به ۰۰۰۶ رفت و
-- به‌جایش قیود یکپارچگی و ستون paid_price_cents آمد). Migrate هر فایل را با
-- *نامش* کلید می‌کند، پس هر پایگاه داده‌ای که نسخهٔ قدیمی را اجرا کرده بود،
-- محتوای تازهٔ ۰۰۰۵ را هرگز نمی‌گیرد — بی‌سروصدا و بدون هیچ خطای مهاجرتی.
--
-- چرا این کشنده است و نه یک نقص جزئی: insertEntry در commerce.go ستون
-- paid_price_cents را بی‌قیدوشرط می‌نویسد. روی چنین پایگاه داده‌ای *هر* ثبت
-- حدس — چه خرید و چه ورود رایگان — با «column does not exist» شکست می‌خورد.
-- یعنی سایت بالا می‌آید، صفحه‌ها بار می‌شوند و فقط دقیقاً همان کاری که کل
-- سیستم برایش ساخته شده کار نمی‌کند.
--
-- درسی که اینجا ثبت می‌شود: فایل مهاجرتِ اجراشده تغییرناپذیر است. اصلاح یعنی
-- فایل تازه، نه ویرایش فایل قدیمی.
--
-- همهٔ عبارت‌های زیر عمداً خنثی (idempotent) هستند تا روی پایگاه داده‌ای که
-- نسخهٔ نهاییِ ۰۰۰۵ را گرفته هیچ اثری نداشته باشند.

-- ---------- ۱) ستونِ بهای پرداخت‌شده ----------
ALTER TABLE entries
    ADD COLUMN IF NOT EXISTS paid_price_cents BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN entries.paid_price_cents IS
    'بهای واقعاً پرداخت‌شدهٔ این حدس در لحظهٔ ثبت؛ ورود رایگان = ۰';

-- شرط paid_price_cents = 0 این UPDATE را خنثی می‌کند: ردیفی که قبلاً پر شده
-- دوباره نوشته نمی‌شود. ورودی رایگان order_id ندارد و روی ۰ می‌ماند، که همان
-- مقدار درست است.
UPDATE entries e
SET paid_price_cents = oi.unit_price_cents
FROM order_items oi
WHERE oi.order_id = e.order_id
  AND oi.competition_prize_id = e.competition_prize_id
  AND e.paid_price_cents = 0
  AND e.order_id IS NOT NULL;

-- ---------- ۲) قیود «سطح جایزه متعلق به همین مسابقه» ----------
DO $$ BEGIN
    ALTER TABLE competition_prizes
        ADD CONSTRAINT uq_cprize_id_comp UNIQUE (id, competition_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

UPDATE order_items oi
SET competition_id = cp.competition_id
FROM competition_prizes cp
WHERE cp.id = oi.competition_prize_id
  AND oi.competition_id <> cp.competition_id;

-- NOT VALID می‌ماند، به همان دلیلی که در ۰۰۰۵ مفصل نوشته شده: اعتبارسنجی
-- ردیف‌های تاریخی یعنی یا برخورد با تریگر تغییرناپذیری یا شکستن زنجیرهٔ هش.
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

-- ---------- ۳) ایندکس درآمد ----------
CREATE INDEX IF NOT EXISTS idx_oi_comp ON order_items(competition_id);

-- ---------- ۴) ایندکس پوشای وضعیت سفارش ----------
-- این هم اینجاست و نه در ۰۰۰۶، به همان دلیلِ بالا: ۰۰۰۶ اجرا شده است.
--
-- idx_entries_comp_order (مهاجرت ۰۰۰۶) فقط جهشِ competition_id را می‌دهد؛
-- تفکیکِ paid از pending هنوز به ازای هر ردیف یک مراجعه به orders لازم دارد.
-- در مقیاس ۲۰٬۰۰۰ حدس، و با توجه به اینکه این شمارش روی مسیر داغِ خرید و دو
-- بار در هر بار باز شدن صفحهٔ مسابقه اجرا می‌شود، همان مراجعه گران‌ترین بخش
-- کار است. orders(id) کلید اصلی است، پس جهش انجام می‌شود اما status از heap
-- خوانده می‌شود؛ ایندکس پوشا هر دو را در خود نگه می‌دارد.
CREATE INDEX IF NOT EXISTS idx_orders_id_status
    ON orders(id) INCLUDE (status);

-- ---------- آنچه عمداً اینجا نیست ----------
-- بخش «بازنشسته کردن قیمت‌های بازماندهٔ دورهٔ یورو» (۰۰۰۵ بند ۳) تکرار
-- نمی‌شود. آن UPDATE در ظاهر خنثی است ولی در عمل نیست: اگر ادمین از آن زمان
-- تا حالا عمداً سطحی را با قیمت پایین فعال کرده باشد، این مهاجرت بی‌خبر
-- غیرفعالش می‌کند و یک مسابقهٔ زنده بی‌جایزه می‌شود. آن بند یک ترمیمِ
-- یک‌بارهٔ وابسته به زمان بود، نه یک قاعدهٔ دائمی.
