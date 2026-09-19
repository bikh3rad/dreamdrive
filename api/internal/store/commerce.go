package store

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrCompetitionClosed = errors.New("competition is not open")
	ErrEntryLimit        = errors.New("entry limit reached for this competition")
	ErrInsider           = errors.New("insiders may not enter competitions")
	ErrBlocked           = errors.New("account is blocked")
	// ErrTargetReached جدا از ErrEntryLimit است و نباید با آن یکی شود:
	// آن یکی یعنی «سهم *تو* تمام شد»، این یعنی «ظرفیت *دوره* پر شد».
	// پیام یکسان کاربر را به جستجوی اشتباه در حساب خودش می‌فرستد.
	ErrTargetReached = errors.New("this competition has reached its entry target")
)

var (
	ErrPrizeUnavailable = errors.New("this prize is not available for sale")
)

// CartLine یک قلم از سبد خرید: چند بلیط برای *یک سطح جایزه*، هر بلیط با
// مختصات خودش.
//
// کاربر می‌تواند در یک دوره چند قلم با جوایز مختلف داشته باشد؛ هر بلیط
// مستقلاً به یک جایزه گره می‌خورد. مسابقه از روی خودِ سطح جایزه استخراج
// می‌شود، نه از ورودی کاربر: اگر هر دو را از سمت مشتری می‌گرفتیم، می‌شد
// سطحِ ارزانِ یک مسابقه را به مسابقهٔ دیگری چسباند.
//
// CompetitionSlug فقط برای پیام خطا و سازگاری فرانت است و هیچ‌جا مبنای
// تصمیم نیست.
type CartLine struct {
	CompetitionSlug    string    `json:"competition_slug"`
	CompetitionPrizeID uuid.UUID `json:"competition_prize_id"`
	Picks              []Point   `json:"picks"`
}

type Point struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type CheckoutResult struct {
	Order   Order   `json:"order"`
	Entries []Entry `json:"entries"`
}

// Checkout سفارش، اقلام و ورودی‌ها را در یک تراکنش اتمیک ایجاد می‌کند.
// اعتبار حساب کاربر (credit_cents) ابتدا مصرف می‌شود و باقی‌مانده به درگاه می‌رود.
func (s *Store) Checkout(ctx context.Context, userID uuid.UUID, lines []CartLine, provider string, useCredit bool) (CheckoutResult, error) {
	var res CheckoutResult
	if len(lines) == 0 {
		return res, errors.New("cart is empty")
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return res, err
	}
	defer tx.Rollback(ctx)

	var user User
	row := tx.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id=$1 FOR UPDATE`, userID)
	if user, err = scanUser(row); err != nil {
		return res, norm(err)
	}
	if user.IsBlocked {
		return res, ErrBlocked
	}
	if user.IsInsider {
		return res, ErrInsider
	}

	// ترتیب قفل‌گرفتن باید قطعی باشد، وگرنه دو سبدِ همزمان با دو مسابقهٔ
	// مشترک و ترتیب وارونه (A,B در برابر B,A) روی سطرهای competitions
	// بن‌بست می‌سازند — و ترتیب اقلام را خودِ مشتری در JSON تعیین می‌کند،
	// پس این بن‌بست از بیرون قابل ایجاد است. Postgres یکی را با 40P01
	// می‌کشد و متن خام خطا به کاربر می‌رسد.
	//
	// شناسهٔ مسابقه فقط از روی سطح جایزه به دست می‌آید، پس اول بدون قفل
	// آن را می‌خوانیم و سپس بر همان مرتب می‌کنیم. این خواندنِ مقدماتی مبنای
	// هیچ تصمیمی نیست؛ حلقهٔ اصلی دوباره و این بار با قفل می‌خواند.
	order := make(map[uuid.UUID]uuid.UUID, len(lines))
	for _, line := range lines {
		if line.CompetitionPrizeID == uuid.Nil {
			continue
		}
		var compID uuid.UUID
		if err := tx.QueryRow(ctx,
			`SELECT competition_id FROM competition_prizes WHERE id=$1`,
			line.CompetitionPrizeID).Scan(&compID); err != nil {
			return res, norm(err)
		}
		order[line.CompetitionPrizeID] = compID
	}
	sorted := make([]CartLine, len(lines))
	copy(sorted, lines)
	sort.SliceStable(sorted, func(i, j int) bool {
		a, b := order[sorted[i].CompetitionPrizeID], order[sorted[j].CompetitionPrizeID]
		if a == b {
			// هم‌مسابقه: ترتیب ثانویه تا مرتب‌سازی قطعی بماند.
			return bytes.Compare(sorted[i].CompetitionPrizeID[:], sorted[j].CompetitionPrizeID[:]) < 0
		}
		return bytes.Compare(a[:], b[:]) < 0
	})
	lines = sorted

	var total int64
	type prepared struct {
		comp      Competition
		level     CompetitionPrize
		unitPrice int64
		picks     []Point
	}
	preps := make([]prepared, 0, len(lines))
	// سقف ورودی در سطح *مسابقه* است، نه سطح جایزه. اگر هر قلم جداگانه
	// شمرده شود، کاربر با دو قلمِ دو جایزهٔ مختلف از یک مسابقه می‌تواند از
	// سقف رد شود. پس تعداد بلیط‌های همین سبد را هم به شمارش اضافه می‌کنیم.
	pending := map[uuid.UUID]int{}

	for _, line := range lines {
		if len(line.Picks) == 0 {
			continue
		}
		if line.CompetitionPrizeID == uuid.Nil {
			return res, errors.New("a prize must be chosen for every ticket")
		}

		// قیمت و مسابقه هر دو از خودِ ردیف سطح خوانده می‌شوند. قیمتی که
		// مشتری فرستاده هیچ‌جا استفاده نمی‌شود — این تنها چیزی است که مانع
		// خریدنِ جایزهٔ گران با قیمت ارزان می‌شود.
		var lvl CompetitionPrize
		if err := tx.QueryRow(ctx,
			`SELECT `+cprizeCols+` FROM competition_prizes cp WHERE cp.id=$1`,
			line.CompetitionPrizeID,
		).Scan(&lvl.ID, &lvl.CompetitionID, &lvl.PrizeID, &lvl.TicketPriceCents,
			&lvl.Sort, &lvl.IsActive, &lvl.CreatedAt); err != nil {
			return res, norm(err)
		}
		if !lvl.IsActive {
			return res, ErrPrizeUnavailable
		}

		// قفل سطر مسابقه تا شمارش ورودی‌ها در برابر رقابت همزمان امن بماند
		var c Competition
		r := tx.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.id=$1 FOR UPDATE`, lvl.CompetitionID)
		if c, err = scanComp(r); err != nil {
			return res, norm(err)
		}
		now := time.Now()
		if c.Status != "open" || now.Before(c.OpensAt) || now.After(c.ClosesAt) {
			return res, fmt.Errorf("%w: %s", ErrCompetitionClosed, c.Slug)
		}
		if c.MaxEntriesUser > 0 {
			var existing int
			if err := tx.QueryRow(ctx,
				`SELECT count(*) FROM entries WHERE competition_id=$1 AND user_id=$2`,
				c.ID, userID).Scan(&existing); err != nil {
				return res, err
			}
			if existing+pending[c.ID]+len(line.Picks) > c.MaxEntriesUser {
				return res, fmt.Errorf("%w: %s", ErrEntryLimit, c.Slug)
			}
		}
		// سقف کل دوره. سطر مسابقه بالاتر FOR UPDATE قفل شده، پس دو خریدِ
		// همزمان روی یک مسابقه پشت سر هم اجرا می‌شوند و نمی‌توانند هر دو
		// آخرین صندلی را بفروشند.
		//
		// اینجا reservedEntries است نه countableEntries: صندلیِ سفارشِ
		// pending هم اشغال است. با شمارشِ «فقط پرداخت‌شده»، حدس‌هایی که همین
		// حالا فروخته شده‌اند برای خریدِ بعدی نامرئی می‌شدند و چون هیچ‌چیز
		// سفارشِ pending را منقضی نمی‌کند، می‌شد با سبدهای پرداخت‌نشده بی‌صدا
		// از سقف عبور کرد.
		//
		// عمداً سبدی که از سقف *رد* شود کامل رد می‌شود و نصفه فروخته نمی‌شود:
		// فروش جزئی یعنی کاربر پول ده بلیط را می‌دهد و سه تا می‌گیرد، و
		// آشتی‌دادن مبلغ سفارش با تعداد ورودی‌ها بعداً کابوس می‌شود.
		if c.EntryTarget > 0 {
			var totalEntries int
			if err := tx.QueryRow(ctx,
				fmt.Sprintf(`SELECT %s`, fmt.Sprintf(reservedEntries, "$1")),
				c.ID).Scan(&totalEntries); err != nil {
				return res, err
			}
			remaining := c.EntryTarget - totalEntries - pending[c.ID]
			if remaining < 0 {
				remaining = 0
			}
			if len(line.Picks) > remaining {
				return res, fmt.Errorf("%w: %s (%d)", ErrTargetReached, c.Slug, remaining)
			}
		}
		pending[c.ID] += len(line.Picks)
		for _, p := range line.Picks {
			if p.X < 0 || p.X > 1 || p.Y < 0 || p.Y > 1 {
				return res, errors.New("coordinates must be normalised between 0 and 1")
			}
		}
		total += lvl.TicketPriceCents * int64(len(line.Picks))
		preps = append(preps, prepared{comp: c, level: lvl, unitPrice: lvl.TicketPriceCents, picks: line.Picks})
	}
	if len(preps) == 0 {
		return res, errors.New("cart is empty")
	}

	creditUsed := int64(0)
	if useCredit && user.CreditCents > 0 {
		creditUsed = min64(user.CreditCents, total)
	}
	due := total - creditUsed

	status := "pending"
	if due == 0 {
		status = "paid"
	}

	var ord Order
	if err := tx.QueryRow(ctx,
		`INSERT INTO orders (user_id, total_cents, currency, status, provider)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, user_id, total_cents, currency, status, provider, provider_ref, created_at, paid_at`,
		userID, total, preps[0].comp.Currency, status, provider,
	).Scan(&ord.ID, &ord.UserID, &ord.TotalCents, &ord.Currency, &ord.Status,
		&ord.Provider, &ord.ProviderRef, &ord.CreatedAt, &ord.PaidAt); err != nil {
		return res, err
	}

	if creditUsed > 0 {
		if _, err := tx.Exec(ctx, `UPDATE users SET credit_cents = credit_cents - $2 WHERE id=$1`,
			userID, creditUsed); err != nil {
			return res, err
		}
	}

	for _, p := range preps {
		if _, err := tx.Exec(ctx,
			`INSERT INTO order_items (order_id, competition_id, competition_prize_id, qty, unit_price_cents)
			 VALUES ($1,$2,$3,$4,$5)`,
			ord.ID, p.comp.ID, p.level.ID, len(p.picks), p.unitPrice); err != nil {
			return res, err
		}
		for _, pick := range p.picks {
			e, err := insertEntry(ctx, tx, userID, p.comp.ID, p.level.ID, &ord.ID, pick.X, pick.Y, false, p.unitPrice)
			if err != nil {
				return res, err
			}
			e.CompetitionSlug = p.comp.Slug
			res.Entries = append(res.Entries, e)
		}
	}

	if status == "paid" {
		if _, err := tx.Exec(ctx, `UPDATE orders SET paid_at=now() WHERE id=$1`, ord.ID); err != nil {
			return res, err
		}
	}

	// اگر همین سبد دوره را به سقف رساند، همین‌جا و در همان تراکنش بسته
	// می‌شود. منتظر جارویِ دقیقه‌ای نمی‌مانیم چون در آن فاصله مسابقه هنوز
	// «باز» است و خریدهای بعدی از سقف عبور می‌کنند.
	for compID := range pending {
		if err := closeIfTargetReached(ctx, tx, compID); err != nil {
			return res, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return res, err
	}
	ord.Status = status
	res.Order = ord
	return res, nil
}

// closeIfTargetReached دوره را در همان تراکنش می‌بندد اگر تعداد حدس‌ها به
// سقف رسیده باشد. باید پس از درج ورودی‌ها و روی سطر قفل‌شدهٔ مسابقه اجرا شود.
//
// شرط status='open' در خود UPDATE است نه در Go: اگر همزمان ادمین وضعیت را
// عوض کرده باشد، نباید تصمیم را روی نسخهٔ کهنه‌ای که در حافظه داریم بگیریم.
//
// شرط EXISTS روی judge_commits عمداً اینجا هم هست و با CloseAtTarget یکی است:
// Commit فقط در وضعیت open/draft مجاز است، پس بستنِ دوره‌ای که هنوز هیچ
// تعهدی ندارد آن را در بن‌بست می‌گذارد — نه داور می‌تواند تعهد بدهد، نه
// Settle اجرا می‌شود (ErrNoCommits). در آن حالت دوره باز می‌ماند تا پنل
// تعهدش را ثبت کند یا closes_at برسد.
func closeIfTargetReached(ctx context.Context, tx pgx.Tx, compID uuid.UUID) error {
	_, err := tx.Exec(ctx, fmt.Sprintf(
		`UPDATE competitions c SET status='closed'
		 WHERE c.id=$1 AND c.status='open' AND c.entry_target > 0
		   AND %s >= c.entry_target
		   AND EXISTS (SELECT 1 FROM judge_commits jc WHERE jc.competition_id = c.id)`,
		fmt.Sprintf(countableEntries, "c.id")),
		compID)
	return err
}

// insertEntry ورودی را با زنجیرهٔ هش (prev_hash → hash) ثبت می‌کند تا دستکاریِ
// گذشته قابل تشخیص باشد. باید داخل تراکنشی اجرا شود که سطر مسابقه را قفل کرده است.
//
// زنجیره در سطح *مسابقه* است و با چند جایزه‌شدن تغییر نمی‌کند: همهٔ بلیط‌ها
// در یک استخر واحد و یک ترتیب seq قرار دارند، فارغ از اینکه کدام جایزه را
// انتخاب کرده‌اند. فرمول هش هم عمداً دست‌نخورده می‌ماند تا ورودی‌های پیش از
// مهاجرت 0004 همچنان قابل راستی‌آزمایی باشند؛ محافظت از پیوند بلیط↔جایزه
// به‌جای هش با تریگر «تغییرناپذیری» در همان مهاجرت انجام می‌شود.
// paidPrice بهای واقعیِ همین بلیط است و در ستون paid_price_cents تثبیت
// می‌شود: پاداش نزدیک‌ترین حدس نباید بعداً قیمت *امروزِ* سطح را بخواند، چون
// ادمین ممکن است قیمت را بین ثبت حدس و تسویه عوض کرده باشد. ورود رایگان ۰.
func insertEntry(ctx context.Context, tx pgx.Tx, userID, compID, cprizeID uuid.UUID, orderID *uuid.UUID, x, y float64, free bool, paidPrice int64) (Entry, error) {
	var e Entry
	var seq int64
	var prevHash string
	err := tx.QueryRow(ctx,
		`SELECT seq, hash FROM entries WHERE competition_id=$1 ORDER BY seq DESC LIMIT 1`, compID).
		Scan(&seq, &prevHash)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return e, err
	}
	seq++

	id := uuid.New()
	createdAt := time.Now().UTC()
	h := EntryHash(prevHash, id, userID, compID, x, y, createdAt)

	err = tx.QueryRow(ctx,
		`INSERT INTO entries (id, user_id, competition_id, competition_prize_id, order_id,
		     x, y, is_free_entry, seq, prev_hash, hash, created_at, paid_price_cents)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
		 RETURNING id, user_id, competition_id, competition_prize_id, x, y, is_free_entry, seq, hash, created_at`,
		id, userID, compID, cprizeID, orderID, x, y, free, seq, prevHash, h, createdAt, paidPrice,
	).Scan(&e.ID, &e.UserID, &e.CompetitionID, &e.CompetitionPrizeID, &e.X, &e.Y,
		&e.IsFreeEntry, &e.Seq, &e.Hash, &e.CreatedAt)
	return e, err
}

// FreeEntry مسیر ورود رایگان (سپر حقوقی) — بدون سفارش، محدود به یک بار در هفته.
//
// شرکت‌کنندهٔ رایگان هم مثل خریدار پولی جایزه‌اش را خودش انتخاب می‌کند. این
// نکتهٔ حقوقی است، نه امکانات اضافه: اگر مسیر رایگان فقط ارزان‌ترین جایزه را
// می‌داد، دیگر «معادل واقعی» مسیر پولی نبود و همان سپر را از دست می‌دادیم.
func (s *Store) FreeEntry(ctx context.Context, userID uuid.UUID, slug string, cprizeID uuid.UUID, x, y float64) (Entry, error) {
	var e Entry
	if cprizeID == uuid.Nil {
		return e, errors.New("a prize must be chosen for every ticket")
	}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return e, err
	}
	defer tx.Rollback(ctx)

	// همان بررسی‌هایی که Checkout روی حساب کاربر می‌کند. نبودشان یعنی حساب
	// مسدود یا کارمند داخلی که از مسیر پولی رد می‌شود، از مسیر رایگان وارد
	// همان استخر می‌شد — و استخر یکی است، پس همان یک برنده را می‌توانست ببرد.
	var user User
	if user, err = scanUser(tx.QueryRow(ctx,
		`SELECT `+userCols+` FROM users WHERE id=$1 FOR UPDATE`, userID)); err != nil {
		return e, norm(err)
	}
	if user.IsBlocked {
		return e, ErrBlocked
	}
	if user.IsInsider {
		return e, ErrInsider
	}

	c, err := scanComp(tx.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.slug=$1 FOR UPDATE`, slug))
	if err != nil {
		return e, norm(err)
	}
	// بازهٔ زمانی هم مثل مسیر پولی بررسی می‌شود. پیش از این فقط وضعیت چک
	// می‌شد، یعنی در فاصلهٔ گذشتنِ closes_at تا اجرای جارویِ دقیقه‌ای، مسیر
	// رایگان هنوز ورودی می‌پذیرفت.
	now := time.Now()
	if c.Status != "open" || now.Before(c.OpensAt) || now.After(c.ClosesAt) {
		return e, ErrCompetitionClosed
	}
	// سقف کل دوره؛ ورودی رایگان هم در همان استخر شمرده می‌شود. مثل گیت خرید،
	// مبنا صندلیِ *رزروشده* است تا سبدهای pending دو بار فروخته نشوند.
	if c.EntryTarget > 0 {
		var totalEntries int
		if err := tx.QueryRow(ctx,
			fmt.Sprintf(`SELECT %s`, fmt.Sprintf(reservedEntries, "$1")),
			c.ID).Scan(&totalEntries); err != nil {
			return e, err
		}
		if totalEntries >= c.EntryTarget {
			return e, ErrTargetReached
		}
	}
	// سقف هر کاربر. مسیر رایگان خودش «یک بار در هر مسابقه» را محدود می‌کند،
	// ولی اگر ادمین سقف را ۰ گذاشته باشد یعنی کاربر اصلاً نباید ورودی داشته
	// باشد و آن قاعده باید اینجا هم اعمال شود.
	if c.MaxEntriesUser > 0 {
		var existing int
		if err := tx.QueryRow(ctx,
			`SELECT count(*) FROM entries WHERE competition_id=$1 AND user_id=$2`,
			c.ID, userID).Scan(&existing); err != nil {
			return e, err
		}
		if existing >= c.MaxEntriesUser {
			return e, ErrEntryLimit
		}
	}

	// سطح جایزه باید *مال همین مسابقه* باشد، وگرنه می‌شد با ورود رایگانِ یک
	// مسابقهٔ بی‌ارزش، بلیط جایزهٔ گران مسابقهٔ دیگر را گرفت.
	var lvlActive bool
	if err := tx.QueryRow(ctx,
		`SELECT is_active FROM competition_prizes WHERE id=$1 AND competition_id=$2`,
		cprizeID, c.ID).Scan(&lvlActive); err != nil {
		return e, norm(err)
	}
	if !lvlActive {
		return e, ErrPrizeUnavailable
	}

	var used int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM entries WHERE user_id=$1 AND competition_id=$2 AND is_free_entry`,
		userID, c.ID).Scan(&used); err != nil {
		return e, err
	}
	if used > 0 {
		return e, errors.New("free entry already used for this competition")
	}
	if e, err = insertEntry(ctx, tx, userID, c.ID, cprizeID, nil, x, y, true, 0); err != nil {
		return e, err
	}
	if err := closeIfTargetReached(ctx, tx, c.ID); err != nil {
		return e, err
	}
	e.CompetitionSlug = c.Slug
	return e, tx.Commit(ctx)
}

// MarkOrderPaid وب‌هوک درگاه پرداخت.
// MarkOrderPaid سفارش را پرداخت‌شده می‌کند و سپس دوره‌های همان سفارش را برای
// رسیدن به سقف بررسی می‌کند.
//
// این بررسی اینجا حیاتی است و جای دیگری نمی‌تواند باشد: حدس‌ها هنگام Checkout
// درج می‌شوند ولی تا وقتی سفارش pending است «قطعی» نیستند، پس بستنِ
// درون‌تراکنشیِ Checkout هرگز با سبدِ خودش فعال نمی‌شود. لحظه‌ای که یک حدس
// قطعی می‌شود دقیقاً همین‌جاست. بدون این، بستنِ دوره تا جاروی دقیقه‌ای عقب
// می‌افتاد و در آن فاصله مسابقه هنوز باز بود.
//
// تراکنش لازم است تا قطعی‌شدن سفارش و بسته‌شدن دوره یک واحد اتمیک باشند.
func (s *Store) MarkOrderPaid(ctx context.Context, orderID uuid.UUID, providerRef string) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx,
		`UPDATE orders SET status='paid', paid_at=now(), provider_ref=$2
		 WHERE id=$1 AND status='pending'`, orderID, providerRef)
	if err != nil {
		return err
	}
	// صفر یعنی سفارش نبود یا قبلاً pending نبوده. idempotent می‌ماند: وبهوکِ
	// تکراری نباید دوباره بستن را اجرا کند.
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}

	// ترتیبِ ثابت بر اساس شناسهٔ مسابقه تا دو وبهوکِ همزمان که مسابقه‌های
	// مشترک دارند قفل‌ها را در یک جهت بگیرند و بن‌بست نسازند.
	rows, err := tx.Query(ctx,
		`SELECT DISTINCT competition_id FROM order_items WHERE order_id=$1
		 ORDER BY competition_id`, orderID)
	if err != nil {
		return err
	}
	var comps []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return err
		}
		comps = append(comps, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, compID := range comps {
		if err := closeIfTargetReached(ctx, tx, compID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (s *Store) RefundOrder(ctx context.Context, orderID uuid.UUID) error {
	_, err := s.DB.Exec(ctx, `UPDATE orders SET status='refunded' WHERE id=$1`, orderID)
	return err
}

type OrderFilter struct {
	UserID *uuid.UUID
	Status string
	Search string
	Limit  int
	Offset int
}

func (s *Store) ListOrders(ctx context.Context, f OrderFilter) ([]Order, int64, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	var uid any
	if f.UserID != nil {
		uid = *f.UserID
	}
	var total int64
	if err := s.DB.QueryRow(ctx,
		`SELECT count(*) FROM orders o JOIN users u ON u.id=o.user_id
		 WHERE ($1::uuid IS NULL OR o.user_id=$1)
		   AND ($2 = '' OR o.status=$2)
		   AND ($3 = '' OR u.email ILIKE '%'||$3||'%')`,
		uid, f.Status, f.Search).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.DB.Query(ctx,
		`SELECT o.id, o.user_id, u.email, o.total_cents, o.currency, o.status,
		        o.provider, o.provider_ref, o.created_at, o.paid_at
		 FROM orders o JOIN users u ON u.id=o.user_id
		 WHERE ($1::uuid IS NULL OR o.user_id=$1)
		   AND ($2 = '' OR o.status=$2)
		   AND ($3 = '' OR u.email ILIKE '%'||$3||'%')
		 ORDER BY o.created_at DESC LIMIT $4 OFFSET $5`,
		uid, f.Status, f.Search, f.Limit, f.Offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []Order{}
	ids := []uuid.UUID{}
	for rows.Next() {
		var o Order
		if err := rows.Scan(&o.ID, &o.UserID, &o.UserEmail, &o.TotalCents, &o.Currency,
			&o.Status, &o.Provider, &o.ProviderRef, &o.CreatedAt, &o.PaidAt); err != nil {
			return nil, 0, err
		}
		out = append(out, o)
		ids = append(ids, o.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}
	if len(ids) == 0 {
		return out, total, nil
	}

	irows, err := s.DB.Query(ctx,
		`SELECT oi.order_id, oi.id, oi.competition_id, c.slug, c.title,
		        oi.competition_prize_id, COALESCE(p.title,''), oi.qty, oi.unit_price_cents
		 FROM order_items oi
		 JOIN competitions c ON c.id=oi.competition_id
		 LEFT JOIN competition_prizes cp ON cp.id=oi.competition_prize_id
		 LEFT JOIN prizes p ON p.id=cp.prize_id
		 WHERE oi.order_id = ANY($1)`, ids)
	if err != nil {
		return nil, 0, err
	}
	defer irows.Close()
	byOrder := map[uuid.UUID][]OrderItem{}
	for irows.Next() {
		var oid uuid.UUID
		var it OrderItem
		if err := irows.Scan(&oid, &it.ID, &it.CompetitionID, &it.CompetitionSlug,
			&it.Title, &it.CompetitionPrizeID, &it.PrizeTitle,
			&it.Qty, &it.UnitPriceCents); err != nil {
			return nil, 0, err
		}
		byOrder[oid] = append(byOrder[oid], it)
	}
	for i := range out {
		out[i].Items = byOrder[out[i].ID]
	}
	return out, total, irows.Err()
}

func min64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}
