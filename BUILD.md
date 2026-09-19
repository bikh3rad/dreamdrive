# گرفتن بیلد با داکر

این دستورها را روی **کامپیوتر خودت** اجرا کن، داخل پوشهٔ `dreamdrive`.

## ۱) فقط بیلد (بدون بالا آوردن سرویس‌ها)

مرحلهٔ کامپایل Go و Next.js همین‌جا اتفاق می‌افتد. اگر خطای کامپایلی در کد
باشد، همین دستور آن را نشان می‌دهد:

```bash
cd dreamdrive
docker compose build api web
```

می‌خواهی خروجی کامل خطاها را ببینی (بدون خلاصه‌سازی و بدون کش):

```bash
docker compose build --no-cache --progress=plain api 2>&1 | tee build-api.log
docker compose build --no-cache --progress=plain web 2>&1 | tee build-web.log
```

اگر بیلد شکست، فایل `build-api.log` یا `build-web.log` را برایم بفرست.

## ۲) بالا آوردن کل سیستم

```bash
docker compose up -d --build
docker compose logs -f api        # تا «listening on :8080» را ببینی
```

مهاجرت‌های پایگاه‌داده هنگام بالا آمدن `api` خودکار اجرا می‌شوند — شامل
`0003_auditor_hardening.sql` که تازه اضافه شده.

## ۳) دادهٔ نمونه

```bash
docker compose run --rm seed
```

این کار حساب ناظر مستقل را هم می‌سازد: `auditor@panel.example`
(گذرواژه‌ها در خروجی همین دستور چاپ می‌شوند).

نشانی‌ها: فرانت `http://localhost:3000` · API `http://localhost:8080` ·
کنسول MinIO `http://localhost:9001`

## ۴) آزمون قفل تسویه — مهم‌ترین چیزی که باید دستی امتحان شود

منطق ناظر مستقل هرگز اجرا نشده است. این سناریو را یک بار برو:

1. با `auditor@panel.example` وارد شو و به `/audit` برو.
2. یک مسابقه انتخاب کن و در بخش «توقف تسویه به تشخیص خودم» یک متن
   بیش از ۲۰ نویسه بنویس و ثبت کن.
3. خارج شو، با حساب مدیر کل وارد شو و همان مسابقه را تسویه کن.
   **باید خطای ۴۰۹ بگیری** با پیام قفل تسویه.
4. برگرد به حساب ناظر، حادثه را با توضیح ببند، بعد دوباره تسویه کن —
   این بار باید انجام شود.

و این دو مورد باید **رد** شوند (اگر نشدند یعنی سخت‌سازی نصب نشده):

```bash
# تلاش برای حذف حادثه — باید خطای append-only بدهد
docker compose exec db psql -U dreamdrive -d dreamdrive \
  -c "DELETE FROM integrity_incidents WHERE id=1;"

# تلاش برای بستن حادثه به نام یک حساب غیر-ناظر — باید رد شود
docker compose exec db psql -U dreamdrive -d dreamdrive -c \
  "UPDATE integrity_incidents SET status='resolved', resolution='باز کردن دستی قفل تسویه بدون مجوز', resolved_by=(SELECT id FROM users WHERE role='superadmin' LIMIT 1) WHERE id=1;"
```

## نکته‌ای که ممکن است در نخستین بیلد ببینی

`api/Dockerfile` عمداً `go mod tidy` را داخل بیلد اجرا می‌کند، چون ممکن است
`go.sum` کامل نباشد. اگر شبکه‌ات به `proxy.golang.org` دسترسی ندارد، همین
مرحله شکست می‌خورد — در آن صورت یک بار روی هاست `go mod tidy` بزن و
`go.sum` حاصل را کنار `go.mod` بگذار.
