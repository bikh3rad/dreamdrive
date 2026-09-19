# DreamDrive — معماری و نقشهٔ راه

نسخهٔ خودمان از مدل BOTB: مسابقهٔ مهارتی **Spot the Ball** با جایزهٔ «ویلای ساحلی + ماشین رویایی».
بک‌اند Go، فرانت‌اند Next.js، دیتابیس PostgreSQL.

> نکته: این پروژه ساختار و جریان کاربریِ سایت مرجع را الگو می‌گیرد، اما تمام کد، متن، برند و
> دارایی‌های بصری از صفر نوشته شده‌اند. هیچ محتوا یا دارایی‌ای از سایت مرجع کپی نشده است.

## ۱. نقشهٔ صفحات (الگو گرفته از جریان BOTB)

### عمومی
| مسیر | توضیح |
|---|---|
| `/` | لندینگ: جایزهٔ این هفته، شمارش معکوس، برندگان اخیر، «چطور بازی کنیم» |
| `/competitions` | لیست همهٔ مسابقات فعال (Dream Prize / Lifestyle) |
| `/competitions/[slug]` | صفحهٔ جایزه: گالری، مشخصات، قیمت بلیط، دکمهٔ بازی |
| `/play/[slug]` | صفحهٔ بازی Spot the Ball (canvas + زوم + انتخاب مختصات) |
| `/how-to-play` | توضیح مکانیک و داوری |
| `/winners` | برندگان + ویدیوی داوری |
| `/free-entry` | مسیر ورود رایگان (سپر حقوقی — الزامی) |
| `/rules`, `/terms`, `/privacy` | صفحات حقوقی از CMS |
| `/cart`, `/checkout` | سبد خرید و پرداخت |

### حساب کاربری
`/account` (داشبورد) · `/account/entries` (بلیط‌ها و مختصات ثبت‌شده) · `/account/orders` ·
`/account/wallet` (اعتبار near-miss) · `/account/kyc` · `/account/settings`

### ادمین (`/admin`)
داشبورد · مسابقات · جوایز و رسانه · سفارش‌ها و پرداخت · کاربران و نقش‌ها ·
داوری (ثبت رأی پنل) · CMS صفحات · بنر و منو و تم · گزارش‌ها · لاگ ممیزی

## ۲. مکانیک بازی و ضدتقلب

هستهٔ حقوقی: **مهارت در برابر شانس**. برنده کسی است که مختصاتش به رأیِ *پنل داوران مستقل*
نزدیک‌تر باشد — نه به موقعیت واقعی توپ. یعنی هیچ‌کس، حتی ادمین، «پاسخ درست» را از پیش نمی‌داند.

سه لایهٔ محافظت که در معماری پیاده شده:

1. **Commit–Reveal برای رأی داوران.** هر داور ابتدا `SHA256(x|y|nonce)` را ثبت می‌کند
   (`judge_commits`). فقط پس از بسته‌شدن مسابقه و ثبت commit همهٔ داوران، مقادیر آشکار
   می‌شوند (`judge_reveals`) و سرور تطابق هش را بررسی می‌کند. رأی نهایی = میانگین.
2. **مهر زمانی و تغییرناپذیری ورودی‌ها.** هر `entry` با `created_at` و یک هش زنجیره‌ای
   (`prev_hash`) ذخیره می‌شود؛ دستکاری گذشته قابل تشخیص است.
3. **جداسازی نقش‌ها + لاگ ممیزی.** نقش‌ها: `user`, `support`, `content_admin`,
   `finance_admin`, `superadmin`, `judge`, `auditor`. هیچ نقش ادمینی به مختصات ورودی‌های
   کاربران دسترسی خواندنی ندارد تا قبل از بسته‌شدن مسابقه. تمام اقدامات ادمین در `audit_log`.
4. **ناظر مستقل و قفل تسویه.** نقش `auditor` فقط می‌خواند (`/audit`) و تنها عمل نوشتنی‌اش
   رسیدگی به حادثهٔ یکپارچگی است. شکستن زنجیره در `integrity_incidents` ثبت می‌شود —
   جدولی که با تریگر `BEFORE UPDATE OR DELETE` فقط‌افزودنی است (GRANT کافی نبود چون
   برنامه با یک کاربر پایگاه‌داده کار می‌کند). `Settle` پیش از هر کاری زنجیره را دوباره
   بررسی می‌کند و اگر حادثهٔ رسیدگی‌نشده‌ای باشد `ErrIncidentOpen` برمی‌گرداند.
   مسیرهای `/api/auditor/*` با `RequireExactRole` گیت شده‌اند، یعنی `superadmin` هم
   راه ندارد؛ وگرنه مالک سیستم می‌توانست حادثهٔ خودش را ببندد.

## ۲٫۵. چرخهٔ عمر یک دوره و «آمادهٔ داوری»

`draft → open → closed → judging → settled` (یا `cancelled`).

«آمادهٔ داوری» وضعیت جداگانه‌ای نیست؛ **دقیقاً همان `closed` است**. گیت‌های
Commit/Reveal/Settle در `judging.go` همگی روی `status IN ('closed','judging')`
بازند، پس افزودن وضعیت تازه فقط قید `CHECK` و آن گیت‌ها را می‌شکست بی‌آنکه چیزی
اضافه کند.

یک دورهٔ `open` با **هر کدام از این دو شرط که زودتر برسد** بسته می‌شود:

1. **زمان:** گذشتن از `closes_at`.
2. **ظرفیت:** رسیدن تعداد حدس‌های **شمارش‌پذیر** آن مسابقه به `entry_target`
   (پیش‌فرض ۲۰٬۰۰۰).

هر دو مقدار هنگام تعریف مسابقه تعیین می‌شوند و در فرم ادمین قابل ویرایش‌اند.
`entry_target = 0` یعنی بدون سقف و فقط زمان تعیین‌کننده است.

«شمارش‌پذیر» یعنی **رایگان یا پرداخت‌شده** — `order_id IS NULL OR
orders.status='paid'`. تعریفش در یک ثابتِ SQL مشترک به نام `countableEntries`
در `catalog.go` است و هر پنج جای خواننده از همان استفاده می‌کنند، تا سه لایهٔ
اعمالِ زیر نتوانند از هم فاصله بگیرند. شمارشِ خامِ `entries` غلط بود: `Checkout`
ورودی‌ها را کنار سفارشِ `pending` درج می‌کند و هیچ سازوکاری سفارش `pending` را
منقضی نمی‌کند، پس یک اسکریپت می‌توانست دوره را با ۲۰٬۰۰۰ حدسِ پرداخت‌نشده ببندد
و کل مسابقه را از کار بیندازد.

هر دو مسیرِ بستنِ خودکار افزون بر این شرط، **وجود دست‌کم یک تعهد داور** را هم
لازم دارند (`EXISTS (SELECT 1 FROM judge_commits …)`). دلیلش این است که `Commit`
فقط در وضعیت `open`/`draft` مجاز است؛ دوره‌ای که زودتر از ثبت تعهدها به سقف
برسد و بسته شود در بن‌بست می‌افتد — `Settle` خطای `ErrNoCommits` می‌دهد و
بازکردن دستی هم بی‌فایده است چون جاروی بعدی دوباره می‌بنددش. با این شرط، چنین
دوره‌ای باز می‌ماند تا هیئت داوران تعهدش را ثبت کند.

شرط ظرفیت در سه لایه اعمال می‌شود، و هر سه لازم‌اند:

- **درون تراکنش خرید/ورود رایگان.** ردیف مسابقه از قبل `FOR UPDATE` قفل است؛
  اگر سبد از ظرفیت باقی‌مانده عبور کند، *کل* سبد با `ErrTargetReached` رد
  می‌شود — نه پرشدن جزئی — وگرنه مبلغ سفارش و تعداد ورودی با هم نمی‌خواند.
  `ErrTargetReached` عمداً از `ErrEntryLimit` جداست: آن یکی «سهم تو تمام شد»
  است، این یکی «ظرفیت دوره پر شد».
- **بلافاصله پس از درج، در همان تراکنش** (`closeIfTargetReached`) تا دوره تا
  تیکِ بعدی باز نماند. شرط `status='open'` داخل SQL است نه Go، تا تغییر وضعیت
  هم‌زمانِ ادمین از روی نسخهٔ کهنهٔ حافظه بازنویسی نشود.
- **جاروی هر دقیقه** (`CloseAtTarget` کنار `CloseExpired` در `main.go`) — تنها
  لایه‌ای که حالت «ادمین سقف را پایین‌تر از تعداد فعلی آورد» را می‌گیرد، چون در
  آن حالت هیچ مسیر نوشتنی‌ای اجرا نمی‌شود. دو جارو مستقل از هم صدا زده می‌شوند
  تا خطای یکی دیگری را معطل نکند.

**درآمد هر مسابقه** از `order_items` جمع زده می‌شود
(`SUM(qty * unit_price_cents)` با `JOIN orders WHERE status='paid'`), نه از
`orders.total_cents` که ممکن است چند مسابقه را پوشش دهد. این کار در متدِ جداگانهٔ
`AttachRevenue` انجام می‌شود و نه به‌صورت یک پرچم روی `ListCompetitions` — چون آن
تابع به `/api/competitions` عمومی هم سرویس می‌دهد و نشت درآمد باید یک تغییر
عامدانه باشد، نه یک بولینِ فراموش‌شده. در JSON هم `revenue_cents` با `omitempty`
است.

## ۳. مدل داده (خلاصه)

```
users            (id, email, password_hash, role, kyc_status, credit_cents, ...)
prizes           (id, slug, title, kind[car|villa|bundle|lifestyle], spec_json, hero_image)
prize_media      (prize_id, url, sort)
competitions     (id, slug, title, currency, opens_at, closes_at, status, image_url,
                  max_entries_user, entry_target)
                 -- prize_id و ticket_price_cents بازنشسته‌اند (مهاجرت ۰۰۰۴): قیمت و
                 -- جایزه به competition_prizes منتقل شد. ستون‌ها فقط برای دادهٔ قدیمی
                 -- مانده‌اند و کد جدید نه می‌خواندشان نه می‌نویسدشان.
                 -- entry_target (مهاجرت ۰۰۰۶، پیش‌فرض ۲۰۰۰۰): سقف کل حدس‌های دوره.
                 -- عمداً در فایل جدا از ۰۰۰۵ است: Migrate هر مهاجرت را با نامِ
                 -- فایلش کلید می‌کند و فایلِ اجراشده را دوباره اجرا نمی‌کند، پس
                 -- افزودن ستون به ۰۰۰۵ روی هر پایگاه دادهٔ موجود بی‌اثر می‌ماند
                 -- در حالی که compCols آن را SELECT می‌کند.
                 -- max_entries_user سهم هر حساب است، entry_target ظرفیت کل دوره.
                 -- هر دو هنگام تعریف مسابقه تعیین می‌شوند و قابل ویرایش‌اند. ۰ یعنی
                 -- بدون سقف.
competition_prizes (id, competition_id, prize_id, ticket_price_cents, sort, is_active)
                 -- هر ردیف یک «سطح» است: جایزه + قیمت بلیطش. یکتا روی
                 -- (competition_id, prize_id) و نیز روی (id, competition_id) تا
                 -- کلید خارجی مرکب بتواند به آن اشاره کند (مهاجرت ۰۰۰۵).
orders           (id, user_id, total_cents, status, provider, provider_ref)
                 -- total_cents می‌تواند چند مسابقه را پوشش دهد؛ برای درآمدِ یک
                 -- مسابقه باید از order_items جمع زد، نه از اینجا.
order_items      (order_id, competition_id, competition_prize_id, qty, unit_price_cents)
                 -- FK مرکب به (competition_prize_id, competition_id) تضمین می‌کند
                 -- سطحِ یک مسابقه زیر مسابقهٔ دیگر فروخته نشود.
entries          (id, user_id, competition_id, competition_prize_id, order_item_id,
                  x, y, prev_hash, hash, paid_price_cents, created_at)
                 -- competition_prize_id پس از ثبت با تریگر قفل می‌شود، چون زیر چتر
                 -- فرمول هش نیست و وگرنه می‌شد جایزهٔ ورودی برنده را عوض کرد.
                 -- همان FK مرکبِ بالا اینجا هم هست.
                 -- paid_price_cents قیمتی است که واقعاً پرداخت شد (مهاجرت ۰۰۰۵).
                 -- پاداش نزدیک‌ترین‌ها از این ستون خوانده می‌شود نه از قیمت امروزِ
                 -- competition_prizes؛ وگرنه تغییر قیمت، اعتبارِ دوره‌های گذشته را
                 -- بازنویسی می‌کرد. ورود رایگان صفر است.
judges           (user_id, display_name, credentials)
judge_commits    (competition_id, judge_id, commit_hash, committed_at)
judge_reveals    (competition_id, judge_id, x, y, nonce, revealed_at)
integrity_incidents (competition_id, kind, detail, first_bad_seq, checked_count,
                     detected_at, status[open|acknowledged|resolved], ack_by,
                     resolution, resolved_by)   -- فقط‌افزودنی، با تریگر
results          (competition_id, final_x, final_y, winner_entry_id, awarded_prize_id, decided_at)
                 -- یک ردیف در هر مسابقه: یک نقطهٔ نهایی، یک برنده. awarded_prize_id
                 -- همان سطحی است که برنده هنگام شرکت انتخاب کرده بود؛ بقیهٔ سطوح
                 -- آن دوره برنده ندارند و این حالت طبیعی است، نه خطا.
pages            (slug, title, body_md, published)     -- CMS
site_settings    (key, value_json)                     -- تم، منو، بنر
audit_log        (actor_id, action, target, meta_json, ip, created_at)
```

## ۴. استک

- **بک‌اند:** Go 1.22 · chi (روتر) · pgx/v5 (Postgres) · golang-jwt · bcrypt · مایگریشن SQL خام
- **فرانت‌اند:** Next.js 14 App Router · TypeScript · Tailwind · بازی روی `<canvas>`
- **زیرساخت:** docker-compose (postgres + api + web)

## ۵. مراحل تحویل

1. ✅ نقشهٔ ساختار و مدل داده
2. بک‌اند: مایگریشن، auth، API عمومی/کاربر/ادمین
3. فرانت‌اند: صفحات عمومی + بازی + سبد خرید
4. پنل ادمین: چهار حوزهٔ درخواستی
5. اجرا، seed، تست، README
