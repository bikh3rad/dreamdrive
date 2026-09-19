package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrNotClosed      = errors.New("competition must be closed before judging")
	ErrCommitMismatch = errors.New("revealed values do not match the committed hash")
	ErrAlreadySettled = errors.New("competition already settled")
	ErrNoCommits      = errors.New("no judge commits recorded")

	ErrAlreadyCommitted = errors.New("a commit is already lodged for this competition and cannot be changed")
)

// CommitHash هشِ تعهد داور را می‌سازد: SHA256("x|y|nonce") با ۶ رقم اعشار ثابت.
// همین فرمت باید سمت داور (خارج از سیستم) استفاده شود.
func CommitHash(x, y float64, nonce string) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%.6f|%.6f|%s", x, y, nonce)))
	return hex.EncodeToString(sum[:])
}

// EntryHash زنجیرهٔ تغییرناپذیری ورودی‌ها.
func EntryHash(prev string, id, userID, compID uuid.UUID, x, y float64, at time.Time) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%s|%s|%.6f|%.6f|%d",
		prev, id, userID, compID, x, y, at.UnixNano())))
	return hex.EncodeToString(sum[:])
}

// Commit ثبت تعهد داور. فقط تا وقتی مسابقه بسته نشده مجاز است تا داور
// نتواند بعد از دیدن ورودی‌ها تصمیم بگیرد.
func (s *Store) Commit(ctx context.Context, compID, judgeID uuid.UUID, hash string) error {
	c, err := s.CompetitionByID(ctx, compID)
	if err != nil {
		return err
	}
	if c.Status != "open" && c.Status != "draft" {
		return errors.New("commits must be lodged before the competition closes")
	}
	// تعهد باید واقعاً یک‌بارمصرف باشد. با DO UPDATE داور می‌توانست تا لحظهٔ
	// بسته‌شدن هرچندبار که خواست هش را عوض کند و این کل ارزش commit-reveal را
	// از بین می‌برد: کسی که ورودی‌های پرتکرار را ببیند می‌تواند تعهدش را روی
	// نقطه‌ای بگذارد که کمترین برنده را بسازد. رابط کاربری هم همین را وعده
	// می‌دهد («قابل تغییر نیست»)، پس سرور باید آن را تضمین کند.
	tag, err := s.DB.Exec(ctx,
		`INSERT INTO judge_commits (competition_id, judge_id, commit_hash) VALUES ($1,$2,$3)
		 ON CONFLICT (competition_id, judge_id) DO NOTHING`,
		compID, judgeID, hash)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrAlreadyCommitted
	}
	return nil
}

// Reveal آشکارسازی رأی داور. سرور تطابق با هشِ تعهد را بررسی می‌کند.
func (s *Store) Reveal(ctx context.Context, compID, judgeID uuid.UUID, x, y float64, nonce string) error {
	c, err := s.CompetitionByID(ctx, compID)
	if err != nil {
		return err
	}
	if c.Status != "closed" && c.Status != "judging" {
		return ErrNotClosed
	}
	var committed string
	if err := s.DB.QueryRow(ctx,
		`SELECT commit_hash FROM judge_commits WHERE competition_id=$1 AND judge_id=$2`,
		compID, judgeID).Scan(&committed); err != nil {
		return norm(err)
	}
	if CommitHash(x, y, nonce) != committed {
		return ErrCommitMismatch
	}
	if _, err := s.DB.Exec(ctx,
		`INSERT INTO judge_reveals (competition_id, judge_id, x, y, nonce) VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT (competition_id, judge_id) DO UPDATE
		     SET x=EXCLUDED.x, y=EXCLUDED.y, nonce=EXCLUDED.nonce, revealed_at=now()`,
		compID, judgeID, x, y, nonce); err != nil {
		return err
	}
	return s.SetCompetitionStatus(ctx, compID, "judging")
}

// JudgePanel وضعیت داوران یک مسابقه. مختصات فقط پس از reveal برگردانده می‌شود.
func (s *Store) JudgePanel(ctx context.Context, compID uuid.UUID) ([]JudgeStatus, error) {
	rows, err := s.DB.Query(ctx,
		`SELECT u.id, u.full_name,
		        (jc.judge_id IS NOT NULL) AS committed,
		        (jr.judge_id IS NOT NULL) AS revealed,
		        jr.x, jr.y
		 FROM users u
		 LEFT JOIN judge_commits jc ON jc.judge_id=u.id AND jc.competition_id=$1
		 LEFT JOIN judge_reveals jr ON jr.judge_id=u.id AND jr.competition_id=$1
		 -- شرط دوم مهم است: Settle همهٔ ردیف‌های judge_commits را می‌شمارد
		 -- بدون توجه به نقش. اگر پنل فقط role='judge' را نشان دهد، کسی که
		 -- با نقش دیگری (مثلاً superadmin) تعهد داده در شمارش هست ولی در
		 -- جدول نیست؛ آن‌وقت ادمین می‌بیند «همه افشا کرده‌اند» اما سرور
		 -- می‌گوید «منتظر ۱ افشا» و هیچ راهی برای یافتن آن نفر نیست.
		 WHERE u.role='judge' OR jc.judge_id IS NOT NULL
		 ORDER BY u.full_name`, compID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []JudgeStatus{}
	for rows.Next() {
		var j JudgeStatus
		if err := rows.Scan(&j.JudgeID, &j.DisplayName, &j.Committed, &j.Revealed, &j.X, &j.Y); err != nil {
			return nil, err
		}
		out = append(out, j)
	}
	return out, rows.Err()
}

// Settle رأی نهایی را از میانگین آرای آشکارشدهٔ داوران می‌سازد و نزدیک‌ترین
// ورودی را برنده اعلام می‌کند. در تساوی، ورودیِ زودتر ثبت‌شده برنده است.
func (s *Store) Settle(ctx context.Context, compID uuid.UUID) (Result, error) {
	var res Result

	c, err := s.CompetitionByID(ctx, compID)
	if err != nil {
		return res, err
	}
	if c.Status == "settled" {
		return res, ErrAlreadySettled
	}
	if c.Status != "closed" && c.Status != "judging" {
		return res, ErrNotClosed
	}

	// زنجیره پیش از تسویه بازمحاسبه می‌شود. اتکا به اینکه «ادمین یادش باشد
	// دکمهٔ بررسی را بزند» کافی نیست: مسیر اصلی باید خودش امن باشد.
	// این بررسی بیرون از تراکنش است چون اسکن کامل entries طولانی است و
	// نباید قفل ردیف مسابقه را آن‌قدر نگه دارد؛ نتیجه‌اش هم تنها می‌تواند
	// حادثه بسازد، نه حادثهٔ موجود را نادیده بگیرد.
	checked, badSeq, err := s.VerifyEntryChain(ctx, compID)
	if err != nil {
		return res, err
	}
	if badSeq != 0 {
		// عمداً روی s.DB و نه روی تراکنش: حادثه باید حتی با شکست تسویه
		// ثبت بماند.
		if _, e := s.RecordIncident(ctx, compID, "chain_broken",
			"زنجیرهٔ هش پیشنهادها در زمان تلاش برای تسویه معیوب بود.",
			badSeq, checked); e != nil {
			return res, e
		}
		return res, ErrIncidentOpen
	}

	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return res, err
	}
	defer tx.Rollback(ctx)

	// ردیف مسابقه را قفل می‌کنیم و وضعیت را *درون* تراکنش دوباره می‌خوانیم.
	// بدون این قفل دو تسویهٔ هم‌زمان هر دو از بررسی بالا رد می‌شدند و
	// awardNearMiss دو بار اعتبار واریز می‌کرد.
	var lockedStatus string
	if err := tx.QueryRow(ctx,
		`SELECT status FROM competitions WHERE id=$1 FOR UPDATE`, compID).
		Scan(&lockedStatus); err != nil {
		return res, err
	}
	if lockedStatus == "settled" {
		return res, ErrAlreadySettled
	}
	if lockedStatus != "closed" && lockedStatus != "judging" {
		return res, ErrNotClosed
	}

	// قفل تسویه: تا وقتی حادثهٔ یکپارچگیِ رسیدگی‌نشده روی این مسابقه ثبت
	// است، هیچ نقشی نمی‌تواند برنده اعلام کند. فقط ناظر مستقل می‌تواند این
	// قفل را با ثبت توضیح مکتوب باز کند.
	//
	// این بررسی باید درون همین تراکنش و پس از قفل‌شدن ردیف باشد: اگر بیرون
	// بود، حادثه‌ای که بین بررسی و Commit ثبت می‌شد نادیده می‌ماند و مسابقه
	// با زنجیرهٔ مشکوک تسویه می‌شد — دقیقاً همان چیزی که قفل برای جلوگیری
	// از آن ساخته شده است.
	var openIncidents int
	if err := tx.QueryRow(ctx,
		`SELECT count(*) FROM integrity_incidents
		  WHERE competition_id=$1 AND status <> 'resolved'`, compID).
		Scan(&openIncidents); err != nil {
		return res, err
	}
	if openIncidents > 0 {
		return res, ErrIncidentOpen
	}

	// همهٔ داورانی که تعهد داده‌اند باید آشکارسازی کرده باشند
	var commits, reveals int
	if err := tx.QueryRow(ctx,
		`SELECT (SELECT count(*) FROM judge_commits WHERE competition_id=$1),
		        (SELECT count(*) FROM judge_reveals WHERE competition_id=$1)`, compID).
		Scan(&commits, &reveals); err != nil {
		return res, err
	}
	if commits == 0 {
		return res, ErrNoCommits
	}
	if reveals < commits {
		return res, fmt.Errorf("waiting on %d judge reveal(s)", commits-reveals)
	}

	var fx, fy float64
	if err := tx.QueryRow(ctx,
		`SELECT avg(x), avg(y) FROM judge_reveals WHERE competition_id=$1`, compID).
		Scan(&fx, &fy); err != nil {
		return res, err
	}

	// یک استخر، یک برنده. انتخابِ جایزه روی این رقابت هیچ اثری ندارد —
	// نه شانس را تغییر می‌دهد نه ترتیب را. فقط تعیین می‌کند اگر این ورودی
	// برنده شد چه چیزی تحویل داده می‌شود.
	//
	// فقط حدس‌های *قطعی* (رایگان یا پرداخت‌شده) در استخر برنده‌اند. بدون این
	// شرط، سفارشِ pending — که هیچ پولی برایش پرداخت نشده و هیچ‌چیز هم
	// منقضی‌اش نمی‌کند — می‌توانست ویلا را ببرد: کافی بود کسی پیش از تسویه
	// سبدهای پرداخت‌نشدهٔ انبوه بزند. سفارشِ refunded هم همین‌طور؛ کسی که پولش
	// را پس گرفته نباید در قرعه بماند.
	var winnerEntry, winnerUser, awardedPrize *uuid.UUID
	var distance float64
	var eID, uID, cpID uuid.UUID
	err = tx.QueryRow(ctx,
		`SELECT e.id, e.user_id, e.competition_prize_id,
		        sqrt(power(e.x-$2,2) + power(e.y-$3,2)) AS d
		 FROM entries e WHERE e.competition_id=$1 AND `+countableEntryPredicate+`
		 ORDER BY d ASC, e.seq ASC LIMIT 1`, compID, fx, fy).Scan(&eID, &uID, &cpID, &distance)
	switch {
	case err == nil:
		winnerEntry, winnerUser, awardedPrize = &eID, &uID, &cpID
	case errors.Is(err, pgx.ErrNoRows):
		// مسابقه بدون هیچ ورودی — نتیجه ثبت می‌شود ولی برنده‌ای نیست
	default:
		return res, err
	}

	// awarded_prize_id از خودِ ورودیِ برنده می‌آید، نه از محاسبه‌ای جدا؛
	// هر منبع دیگری می‌توانست با چیزی که کاربر خریده اختلاف پیدا کند.
	// باقی جوایز این دوره برنده ندارند و این حالت طبیعی است.
	if err := tx.QueryRow(ctx,
		`INSERT INTO results (competition_id, final_x, final_y, winner_entry_id, winner_user_id, awarded_prize_id, distance)
		 VALUES ($1,$2,$3,$4,$5,$6,$7)
		 ON CONFLICT (competition_id) DO UPDATE SET final_x=EXCLUDED.final_x, final_y=EXCLUDED.final_y,
		     winner_entry_id=EXCLUDED.winner_entry_id, winner_user_id=EXCLUDED.winner_user_id,
		     awarded_prize_id=EXCLUDED.awarded_prize_id,
		     distance=EXCLUDED.distance, decided_at=now()
		 RETURNING competition_id, final_x, final_y, winner_entry_id, winner_user_id, awarded_prize_id, distance, video_url, decided_at`,
		compID, fx, fy, winnerEntry, winnerUser, awardedPrize, distance,
	).Scan(&res.CompetitionID, &res.FinalX, &res.FinalY, &res.WinnerEntryID,
		&res.WinnerUserID, &res.AwardedPrizeID, &res.Distance, &res.VideoURL, &res.DecidedAt); err != nil {
		return res, err
	}

	if _, err := tx.Exec(ctx, `UPDATE competitions SET status='settled' WHERE id=$1`, compID); err != nil {
		return res, err
	}

	// پاداش near-miss: تا ۱۰۰٪ قیمت بلیط اعتبار، به نسبت نزدیکیِ ورودی.
	// قیمت هر ورودی از سطح جایزهٔ خودش خوانده می‌شود، نه یک قیمت واحد؛
	// وگرنه خریدار بلیط ارزان بیش از آنچه پرداخته اعتبار می‌گرفت.
	if err := awardNearMiss(ctx, tx, compID, fx, fy); err != nil {
		return res, err
	}

	if err := tx.Commit(ctx); err != nil {
		return res, err
	}
	// INSERT…RETURNING به جدول users پیوند نمی‌خورد، پس نام و ایمیل برنده
	// خالی می‌ماند. یک بار دوباره می‌خوانیم تا پاسخ تسویه با ResultFor یکسان باشد.
	if full, err := s.ResultFor(ctx, compID); err == nil {
		return full, nil
	}
	return res, nil
}

// awardNearMiss به ورودی‌هایی که فاصله‌شان کمتر از آستانه است اعتبار می‌دهد.
//
// مبنا بهای *پرداخت‌شدهٔ همان بلیط* است (entries.paid_price_cents)، نه قیمت
// امروزِ سطح جایزه: قیمت سطح قابل ویرایش است و اگر ادمین آن را بین ثبت حدس و
// تسویه بالا ببرد، پاداش بر اساس مبلغی حساب می‌شد که کاربر هرگز نپرداخته.
//
// ورودی رایگان صفر می‌گیرد: چیزی نپرداخته که بخشی از آن برگردد، و در غیر این
// صورت مسیر رایگان به یک کانال درآمد تبدیل می‌شد — کسی که هفته‌ها ورودی
// رایگان بزند بدون هیچ پرداختی اعتبار جمع می‌کرد.
func awardNearMiss(ctx context.Context, tx pgx.Tx, compID uuid.UUID, fx, fy float64) error {
	const threshold = 0.05 // ۵٪ قطر تصویر
	_, err := tx.Exec(ctx,
		`WITH near AS (
		   SELECT e.user_id,
		          CASE WHEN e.is_free_entry THEN 0 ELSE e.paid_price_cents END AS price,
		          sqrt(power(e.x-$2,2)+power(e.y-$3,2)) AS d
		   FROM entries e
		   WHERE e.competition_id=$1 AND `+countableEntryPredicate+`
		 ), credited AS (
		   SELECT user_id, sum(round(price * (1 - d/$4))::bigint) AS cents
		   FROM near WHERE d < $4 GROUP BY user_id
		 )
		 UPDATE users u SET credit_cents = u.credit_cents + c.cents
		 FROM credited c WHERE u.id = c.user_id AND c.cents > 0`,
		compID, fx, fy, threshold)
	return err
}

func (s *Store) ResultFor(ctx context.Context, compID uuid.UUID) (Result, error) {
	var r Result
	err := s.DB.QueryRow(ctx,
		`SELECT r.competition_id, r.final_x, r.final_y, r.winner_entry_id, r.winner_user_id,
		        COALESCE(u.email,''),
		        COALESCE(NULLIF(u.full_name,''), 'برندهٔ تأییدشده'),
		        r.awarded_prize_id, COALESCE(p.title,''),
		        r.distance, r.video_url, r.decided_at
		 FROM results r
		 LEFT JOIN users u ON u.id=r.winner_user_id
		 LEFT JOIN competition_prizes cp ON cp.id=r.awarded_prize_id
		 LEFT JOIN prizes p ON p.id=cp.prize_id
		 WHERE r.competition_id=$1`, compID).
		Scan(&r.CompetitionID, &r.FinalX, &r.FinalY, &r.WinnerEntryID, &r.WinnerUserID,
			&r.WinnerEmail, &r.WinnerName, &r.AwardedPrizeID, &r.AwardedTitle,
			&r.Distance, &r.VideoURL, &r.DecidedAt)
	return r, norm(err)
}

func (s *Store) SetResultVideo(ctx context.Context, compID uuid.UUID, url string) error {
	_, err := s.DB.Exec(ctx, `UPDATE results SET video_url=$2 WHERE competition_id=$1`, compID, url)
	return err
}

// VerifyEntryChain زنجیرهٔ هش ورودی‌های یک مسابقه را بازمحاسبه می‌کند.
// خروجی: تعداد بررسی‌شده و اولین seq معیوب (۰ یعنی سالم).
func (s *Store) VerifyEntryChain(ctx context.Context, compID uuid.UUID) (int64, int64, error) {
	rows, err := s.DB.Query(ctx,
		`SELECT id, user_id, competition_id, x, y, seq, prev_hash, hash, created_at
		 FROM entries WHERE competition_id=$1 ORDER BY seq`, compID)
	if err != nil {
		return 0, 0, err
	}
	defer rows.Close()

	var count int64
	prev := ""
	for rows.Next() {
		var id, uid, cid uuid.UUID
		var x, y float64
		var seq int64
		var prevHash, hash string
		var at time.Time
		if err := rows.Scan(&id, &uid, &cid, &x, &y, &seq, &prevHash, &hash, &at); err != nil {
			return count, 0, err
		}
		if prevHash != prev || EntryHash(prev, id, uid, cid, x, y, at.UTC()) != hash {
			return count, seq, nil
		}
		prev = hash
		count++
	}
	return count, 0, rows.Err()
}

// ListEntries — دسترسی ادمین به ورودی‌ها فقط پس از بسته‌شدن مسابقه مجاز است.
func (s *Store) ListEntries(ctx context.Context, compID uuid.UUID, limit int) ([]Entry, error) {
	c, err := s.CompetitionByID(ctx, compID)
	if err != nil {
		return nil, err
	}
	if c.Status == "open" || c.Status == "draft" {
		return nil, errors.New("entry coordinates are sealed until the competition closes")
	}
	if limit <= 0 || limit > 1000 {
		limit = 200
	}
	rows, err := s.DB.Query(ctx,
		`SELECT e.id, e.user_id, e.competition_id, e.competition_prize_id, COALESCE(p.title,''),
		        e.x, e.y, e.is_free_entry, e.seq, e.hash, e.created_at
		 FROM entries e
		 LEFT JOIN competition_prizes cp ON cp.id=e.competition_prize_id
		 LEFT JOIN prizes p ON p.id=cp.prize_id
		 WHERE e.competition_id=$1 ORDER BY e.seq LIMIT $2`, compID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanEntries(rows)
}

func (s *Store) EntriesForUser(ctx context.Context, userID uuid.UUID) ([]Entry, error) {
	rows, err := s.DB.Query(ctx,
		`SELECT e.id, e.user_id, e.competition_id, e.competition_prize_id, COALESCE(p.title,''),
		        e.x, e.y, e.is_free_entry, e.seq, e.hash, e.created_at, c.slug
		 FROM entries e
		 JOIN competitions c ON c.id=e.competition_id
		 LEFT JOIN competition_prizes cp ON cp.id=e.competition_prize_id
		 LEFT JOIN prizes p ON p.id=cp.prize_id
		 WHERE e.user_id=$1 ORDER BY e.created_at DESC LIMIT 500`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.UserID, &e.CompetitionID, &e.CompetitionPrizeID,
			&e.PrizeTitle, &e.X, &e.Y,
			&e.IsFreeEntry, &e.Seq, &e.Hash, &e.CreatedAt, &e.CompetitionSlug); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

type rowScanner interface {
	Next() bool
	Scan(...any) error
	Err() error
}

func scanEntries(rows rowScanner) ([]Entry, error) {
	out := []Entry{}
	for rows.Next() {
		var e Entry
		if err := rows.Scan(&e.ID, &e.UserID, &e.CompetitionID, &e.CompetitionPrizeID,
			&e.PrizeTitle, &e.X, &e.Y,
			&e.IsFreeEntry, &e.Seq, &e.Hash, &e.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

// Distance فاصلهٔ اقلیدسی نرمال‌شده.
func Distance(x1, y1, x2, y2 float64) float64 {
	return math.Hypot(x1-x2, y1-y2)
}
