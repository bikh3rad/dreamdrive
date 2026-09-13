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

## ۳. مدل داده (خلاصه)

```
users            (id, email, password_hash, role, kyc_status, credit_cents, ...)
prizes           (id, slug, title, kind[car|villa|bundle|lifestyle], spec_json, hero_image)
prize_media      (prize_id, url, sort)
competitions     (id, slug, prize_id, ticket_price_cents, opens_at, closes_at, status, image_url)
orders           (id, user_id, total_cents, status, provider, provider_ref)
order_items      (order_id, competition_id, qty, unit_price_cents)
entries          (id, user_id, competition_id, order_item_id, x, y, prev_hash, hash, created_at)
judges           (user_id, display_name, credentials)
judge_commits    (competition_id, judge_id, commit_hash, committed_at)
judge_reveals    (competition_id, judge_id, x, y, nonce, revealed_at)
integrity_incidents (competition_id, kind, detail, first_bad_seq, checked_count,
                     detected_at, status[open|acknowledged|resolved], ack_by,
                     resolution, resolved_by)   -- فقط‌افزودنی، با تریگر
results          (competition_id, final_x, final_y, winner_entry_id, decided_at)
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
