package store

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// ---------- Prizes ----------

const prizeCols = `id, slug, title, kind, subtitle, body_md, spec, value_cents, hero_image, created_at`

func scanPrize(row interface{ Scan(...any) error }) (Prize, error) {
	var p Prize
	err := row.Scan(&p.ID, &p.Slug, &p.Title, &p.Kind, &p.Subtitle, &p.BodyMD,
		&p.Spec, &p.ValueCents, &p.HeroImage, &p.CreatedAt)
	return p, err
}

func (s *Store) ListPrizes(ctx context.Context) ([]Prize, error) {
	rows, err := s.DB.Query(ctx, `SELECT `+prizeCols+` FROM prizes ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Prize{}
	for rows.Next() {
		p, err := scanPrize(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) PrizeByID(ctx context.Context, id uuid.UUID) (Prize, error) {
	p, err := scanPrize(s.DB.QueryRow(ctx, `SELECT `+prizeCols+` FROM prizes WHERE id=$1`, id))
	if err != nil {
		return p, norm(err)
	}
	p.Media, err = s.prizeMedia(ctx, id)
	return p, err
}

func (s *Store) prizeMedia(ctx context.Context, prizeID uuid.UUID) ([]PrizeMedia, error) {
	rows, err := s.DB.Query(ctx,
		`SELECT id, url, caption, sort FROM prize_media WHERE prize_id=$1 ORDER BY sort, id`, prizeID)
	if err != nil {
		slog.Error("prizeMedia", "error", err)

		return nil, err
	}
	defer rows.Close()
	out := []PrizeMedia{}
	for rows.Next() {
		var m PrizeMedia
		if err := rows.Scan(&m.ID, &m.URL, &m.Caption, &m.Sort); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

type PrizeInput struct {
	Slug       string         `json:"slug"`
	Title      string         `json:"title"`
	Kind       string         `json:"kind"`
	Subtitle   string         `json:"subtitle"`
	BodyMD     string         `json:"body_md"`
	Spec       map[string]any `json:"spec"`
	ValueCents int64          `json:"value_cents"`
	HeroImage  string         `json:"hero_image"`
}

func (s *Store) CreatePrize(ctx context.Context, in PrizeInput) (Prize, error) {
	if in.Spec == nil {
		in.Spec = map[string]any{}
	}
	row := s.DB.QueryRow(ctx,
		`INSERT INTO prizes (slug, title, kind, subtitle, body_md, spec, value_cents, hero_image)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING `+prizeCols,
		in.Slug, in.Title, in.Kind, in.Subtitle, in.BodyMD, in.Spec, in.ValueCents, in.HeroImage)
	p, err := scanPrize(row)
	return p, norm(err)
}

func (s *Store) UpdatePrize(ctx context.Context, id uuid.UUID, in PrizeInput) (Prize, error) {
	if in.Spec == nil {
		in.Spec = map[string]any{}
	}
	row := s.DB.QueryRow(ctx,
		`UPDATE prizes SET slug=$2, title=$3, kind=$4, subtitle=$5, body_md=$6,
		        spec=$7, value_cents=$8, hero_image=$9
		 WHERE id=$1 RETURNING `+prizeCols,
		id, in.Slug, in.Title, in.Kind, in.Subtitle, in.BodyMD, in.Spec, in.ValueCents, in.HeroImage)
	p, err := scanPrize(row)
	return p, norm(err)
}

func (s *Store) DeletePrize(ctx context.Context, id uuid.UUID) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM prizes WHERE id=$1`, id)
	return err
}

func (s *Store) AddPrizeMedia(ctx context.Context, prizeID uuid.UUID, url, caption string, sort int) error {
	_, err := s.DB.Exec(ctx,
		`INSERT INTO prize_media (prize_id, url, caption, sort) VALUES ($1,$2,$3,$4)`,
		prizeID, url, caption, sort)
	return err
}

func (s *Store) DeletePrizeMedia(ctx context.Context, id uuid.UUID) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM prize_media WHERE id=$1`, id)
	return err
}

// ---------- Competitions ----------

// دو نسخه لازم است و ترتیب ستون‌ها در هر دو باید با scanComp یکی بماند.
//
// compCols با پیشوند «c.» فقط جایی کار می‌کند که نام مستعار c تعریف شده
// باشد، یعنی در SELECT … FROM competitions c. در INSERT/UPDATE … RETURNING
// چنین نام مستعاری وجود ندارد و Postgres خطای 42P01 می‌دهد.
//
// ticket_price_cents پس از مهاجرت 0004 می‌تواند NULL باشد (قیمت به سطوح
// جایزه منتقل شده). COALESCE می‌گذاریم تا اسکن به int64 نشکند؛ صفرِ حاصل
// هیچ‌جا مبنای محاسبه نیست و فقط برای سازگاری JSON خوانده می‌شود.
const compCols = `c.id, c.slug, c.prize_id, c.title, COALESCE(c.ticket_price_cents,0), c.currency,
	c.board_image, c.opens_at, c.closes_at, c.status, c.max_entries_user, c.entry_target, c.created_at`

// compColsBare برای RETURNING در INSERT و UPDATE.
const compColsBare = `id, slug, prize_id, title, COALESCE(ticket_price_cents,0), currency,
	board_image, opens_at, closes_at, status, max_entries_user, entry_target, created_at`

func scanComp(row interface{ Scan(...any) error }) (Competition, error) {
	var c Competition
	err := row.Scan(&c.ID, &c.Slug, &c.PrizeID, &c.Title, &c.TicketPriceCents, &c.Currency,
		&c.BoardImage, &c.OpensAt, &c.ClosesAt, &c.Status, &c.MaxEntriesUser, &c.EntryTarget,
		&c.CreatedAt)
	return c, err
}

// ---------- سطوح جایزه یک مسابقه ----------

const cprizeCols = `cp.id, cp.competition_id, cp.prize_id, cp.ticket_price_cents,
	cp.sort, cp.is_active, cp.created_at`

// CompetitionPrizes سطوح یک مسابقه را با جزئیات جایزه برمی‌گرداند.
// onlyActive برای صفحات عمومی؛ پنل ادمین باید غیرفعال‌ها را هم ببیند وگرنه
// نمی‌تواند دوباره فعالشان کند.
func (s *Store) CompetitionPrizes(ctx context.Context, compID uuid.UUID, onlyActive bool) ([]CompetitionPrize, error) {
	rows, err := s.DB.Query(ctx,
		`SELECT `+cprizeCols+`
		 FROM competition_prizes cp
		 WHERE cp.competition_id=$1 AND ($2 = FALSE OR cp.is_active)
		 ORDER BY cp.sort, cp.created_at`, compID, onlyActive)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []CompetitionPrize{}
	for rows.Next() {
		var cp CompetitionPrize
		if err := rows.Scan(&cp.ID, &cp.CompetitionID, &cp.PrizeID,
			&cp.TicketPriceCents, &cp.Sort, &cp.IsActive, &cp.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, cp)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range out {
		if p, err := s.PrizeByID(ctx, out[i].PrizeID); err == nil {
			out[i].Prize = &p
		}
	}
	return out, nil
}

// CompetitionPrizeInput یک سطح در فرم ادمین.
type CompetitionPrizeInput struct {
	PrizeID          uuid.UUID `json:"prize_id"`
	TicketPriceCents int64     `json:"ticket_price_cents"`
	Sort             int       `json:"sort"`
	IsActive         bool      `json:"is_active"`
}

// SetCompetitionPrizes سطوح یک مسابقه را جایگزین می‌کند.
//
// عمداً حذف‌ونوشتن ساده نیست: ردیفی که ورودی به آن اشاره دارد نباید پاک شود،
// وگرنه معلوم نمی‌ماند بلیط‌های فروخته‌شده برای چه جایزه‌ای بوده‌اند و
// ON DELETE RESTRICT هم کل تراکنش را می‌شکند. سطحی که در فهرست تازه نیامده
// غیرفعال می‌شود، نه حذف.
func (s *Store) SetCompetitionPrizes(ctx context.Context, compID uuid.UUID, in []CompetitionPrizeInput) error {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	keep := make([]uuid.UUID, 0, len(in))
	for _, lvl := range in {
		if lvl.TicketPriceCents < 0 {
			return errors.New("ticket price cannot be negative")
		}
		// is_active از ورودی می‌آید و هاردکد نیست: «بازنشسته کردن یک سطح»
		// مسیر توصیه‌شده در پنل است و اگر اینجا TRUE بنویسیم، ادمین تیک را
		// برمی‌دارد، خطایی نمی‌بیند و سطح بی‌سروصدا به فروش ادامه می‌دهد.
		var id uuid.UUID
		if err := tx.QueryRow(ctx,
			`INSERT INTO competition_prizes
			     (competition_id, prize_id, ticket_price_cents, sort, is_active)
			 VALUES ($1,$2,$3,$4,$5)
			 ON CONFLICT (competition_id, prize_id) DO UPDATE
			     SET ticket_price_cents = EXCLUDED.ticket_price_cents,
			         sort               = EXCLUDED.sort,
			         is_active          = EXCLUDED.is_active
			 RETURNING id`,
			compID, lvl.PrizeID, lvl.TicketPriceCents, lvl.Sort, lvl.IsActive).Scan(&id); err != nil {
			return err
		}
		keep = append(keep, id)
	}

	// سطوح حذف‌شده از فرم: اگر بلیطی نفروخته‌اند واقعاً پاک می‌شوند، وگرنه
	// فقط از فروش کنار می‌روند و تاریخچه دست‌نخورده می‌ماند.
	if _, err := tx.Exec(ctx,
		`UPDATE competition_prizes SET is_active=FALSE
		  WHERE competition_id=$1 AND NOT (id = ANY($2))`, compID, keep); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`DELETE FROM competition_prizes cp
		  WHERE cp.competition_id=$1 AND NOT (cp.id = ANY($2))
		    AND NOT EXISTS (SELECT 1 FROM entries e WHERE e.competition_prize_id = cp.id)
		    AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.competition_prize_id = cp.id)`,
		compID, keep); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ListCompetitions اگر statuses خالی باشد همه را برمی‌گرداند.
//
// includeRetired تعیین می‌کند سطوح غیرفعال هم همراه شوند. برای پنل ادمین و
// ناظر لازم است، ولی مسیرهای عمومی باید false بدهند: فرستادن سطح بازنشسته به
// مرورگر یعنی تکیه بر فیلتر سمت کلاینت برای جلوگیری از فروشِ جایزه‌ای که
// دیگر نباید فروخته شود.
func (s *Store) ListCompetitions(ctx context.Context, statuses []string, withPrize, includeRetired bool) ([]Competition, error) {
	// شمارش با همان تعریفِ «شمارش‌پذیر» که سقف دوره با آن سنجیده می‌شود،
	// وگرنه عددِ فهرست با عددی که دوره را می‌بندد نمی‌خواند.
	q := `SELECT ` + compCols + `, ` + fmt.Sprintf(countableEntries, "c.id") + `
	      FROM competitions c
	      WHERE ($1::text[] IS NULL OR c.status = ANY($1))
	      ORDER BY c.closes_at ASC`
	var arg any
	if len(statuses) > 0 {
		arg = statuses
	}
	rows, err := s.DB.Query(ctx, q, arg)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Competition{}
	for rows.Next() {
		var c Competition
		if err := rows.Scan(&c.ID, &c.Slug, &c.PrizeID, &c.Title, &c.TicketPriceCents, &c.Currency,
			&c.BoardImage, &c.OpensAt, &c.ClosesAt, &c.Status, &c.MaxEntriesUser, &c.EntryTarget,
			&c.CreatedAt, &c.EntryCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if withPrize {
		for i := range out {
			// سطوح جایزه مرجع اصلی‌اند.
			if lv, err := s.CompetitionPrizes(ctx, out[i].ID, !includeRetired); err == nil {
				out[i].Prizes = lv
				out[i].Prize = headlinePrize(lv)
			}
		}
	}
	return out, nil
}

// AttachRevenue جمع فروش پرداخت‌شدهٔ هر مسابقه را روی همان ردیف‌ها می‌نشاند.
//
// چرا جدا از ListCompetitions و نه یک زیرپرس‌وجوی دیگر در همان SELECT:
// ListCompetitions مسیر عمومی /api/competitions را هم سرویس می‌دهد و درآمد
// یک عدد داخلی است. با متد جدا، تنها جایی که صدایش می‌زند پنل ادمین است و
// نشت‌دادنش نیازمند یک تغییر عمدی می‌شود، نه فراموش‌کردن یک پرچم.
//
// مبنا order_items است نه orders.total_cents: یک سفارش می‌تواند چند مسابقه
// را در بر بگیرد، پس total_cents به هیچ مسابقه‌ای قابل انتساب نیست.
// فقط سفارش‌های paid شمرده می‌شوند — pending هنوز پولی نیاورده و refunded
// پولش برگشته است.
func (s *Store) AttachRevenue(ctx context.Context, comps []Competition) error {
	if len(comps) == 0 {
		return nil
	}
	ids := make([]uuid.UUID, len(comps))
	for i := range comps {
		ids[i] = comps[i].ID
	}
	rows, err := s.DB.Query(ctx,
		`SELECT oi.competition_id, COALESCE(sum(oi.qty * oi.unit_price_cents),0)
		 FROM order_items oi
		 JOIN orders o ON o.id = oi.order_id
		 WHERE o.status = 'paid' AND oi.competition_id = ANY($1)
		 GROUP BY oi.competition_id`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	byID := map[uuid.UUID]int64{}
	for rows.Next() {
		var id uuid.UUID
		var cents int64
		if err := rows.Scan(&id, &cents); err != nil {
			return err
		}
		byID[id] = cents
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for i := range comps {
		comps[i].RevenueCents = byID[comps[i].ID]
	}
	return nil
}

// headlinePrize جایزهٔ شاخص برای نمایش کارت و تصویر اصلی: گران‌ترین سطح فعال.
// اگر همه بازنشسته باشند، نخستین سطح موجود — تا صفحهٔ مسابقهٔ قدیمی خالی نماند.
func headlinePrize(levels []CompetitionPrize) *Prize {
	var best *CompetitionPrize
	for i := range levels {
		if !levels[i].IsActive {
			continue
		}
		if best == nil || levels[i].TicketPriceCents > best.TicketPriceCents {
			best = &levels[i]
		}
	}
	if best == nil && len(levels) > 0 {
		best = &levels[0]
	}
	if best == nil {
		return nil
	}
	return best.Prize
}

// CompetitionBySlug مسیر عمومی است و فقط سطوح فعال را برمی‌گرداند؛ سطح
// بازنشسته نباید به صفحهٔ بازی برسد. پنل ادمین از CompetitionByID و
// ListCompetitions(..., includeRetired=true) استفاده می‌کند.
func (s *Store) CompetitionBySlug(ctx context.Context, slug string) (Competition, error) {
	c, err := scanComp(s.DB.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.slug=$1`, slug))
	if err != nil {
		return c, norm(err)
	}
	if lv, err := s.CompetitionPrizes(ctx, c.ID, true); err == nil {
		c.Prizes = lv
		c.Prize = headlinePrize(lv)
	}
	if err := s.DB.QueryRow(ctx,
		fmt.Sprintf(`SELECT %s`, fmt.Sprintf(countableEntries, "$1")),
		c.ID).Scan(&c.EntryCount); err != nil {
		slog.Error("competitionEntryCount", "competition", c.ID, "error", err)
	}
	return c, nil
}

func (s *Store) CompetitionByID(ctx context.Context, id uuid.UUID) (Competition, error) {
	c, err := scanComp(s.DB.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.id=$1`, id))
	if err != nil {
		return c, norm(err)
	}
	// شمارش ورودی‌ها اینجا هم لازم است: هرجا entry_target معنا دارد، بدون
	// EntryCount عدد صفر دیده می‌شود و «۰ از ۲۰۰۰۰» گزارش می‌شود.
	//
	// همان تعریفِ «شمارش‌پذیر» که سقف با آن سنجیده می‌شود، وگرنه نوار پیشرفت
	// عددی نشان می‌دهد که هیچ‌وقت به سقف نمی‌رسد یا زودتر از بسته‌شدن پر
	// می‌شود. خطا کشنده نیست ولی بی‌صدا هم نمی‌ماند: صفرِ ناشی از خطا از
	// صفرِ واقعی قابل تشخیص نیست.
	if err := s.DB.QueryRow(ctx,
		fmt.Sprintf(`SELECT %s`, fmt.Sprintf(countableEntries, "$1")),
		c.ID).Scan(&c.EntryCount); err != nil {
		slog.Error("competitionEntryCount", "competition", c.ID, "error", err)
	}
	return c, nil
}

// CompetitionInput دیگر قیمت و جایزهٔ واحد ندارد؛ هر دو به Prizes منتقل شده‌اند.
// Currency روی خود مسابقه می‌ماند چون همهٔ سطوح یک دوره با یک واحد پول فروخته
// می‌شوند.
type CompetitionInput struct {
	Slug           string    `json:"slug"`
	Title          string    `json:"title"`
	Currency       string    `json:"currency"`
	BoardImage     string    `json:"board_image"`
	OpensAt        time.Time `json:"opens_at"`
	ClosesAt       time.Time `json:"closes_at"`
	Status         string    `json:"status"`
	MaxEntriesUser int       `json:"max_entries_user"`
	// EntryTarget سقف کل حدس‌های دوره. ۰ = بدون سقف.
	//
	// اشاره‌گر است تا «نفرستاده» از «صریحاً صفر» قابل تفکیک باشد. با int
	// ساده، هر کلاینتی که این فیلد را نمی‌شناسد صفرِ Go می‌گرفت و صفر یعنی
	// «بدون سقف» — یعنی دقیقاً وارونهٔ قاعدهٔ کسب‌وکار، بی‌صدا. DEFAULT ستون
	// هم نجات نمی‌داد چون INSERT این ستون را صریح می‌نویسد.
	EntryTarget *int `json:"entry_target"`

	Prizes []CompetitionPrizeInput `json:"prizes"`
}

// DefaultEntryTarget قاعدهٔ کسب‌وکار: دوره با ۲۰٬۰۰۰ حدس آمادهٔ داوری می‌شود.
// باید با DEFAULT ستون در مهاجرت ۰۰۰۶ یکی بماند.
const DefaultEntryTarget = 20000

// entryTarget مقدار مؤثر را می‌دهد: نبودِ فیلد یعنی قاعدهٔ پیش‌فرض، نه صفر.
func (in CompetitionInput) entryTarget() int {
	if in.EntryTarget == nil {
		return DefaultEntryTarget
	}
	return *in.EntryTarget
}

// validate جلوی مسابقهٔ بی‌جایزه را می‌گیرد. مسابقه‌ای که سطح فعال ندارد
// قابل خرید نیست ولی در فهرست عمومی دیده می‌شود — بدترین حالت: کاربر روی
// «شرکت می‌کنم» می‌زند و به بن‌بست می‌خورد.
func (in CompetitionInput) validate() error {
	if len(in.Prizes) == 0 {
		return errors.New("competition needs at least one prize")
	}
	seen := map[uuid.UUID]bool{}
	for _, p := range in.Prizes {
		if p.PrizeID == uuid.Nil {
			return errors.New("prize id is required")
		}
		if seen[p.PrizeID] {
			return errors.New("duplicate prize in competition")
		}
		seen[p.PrizeID] = true
		if p.TicketPriceCents < 0 {
			return errors.New("ticket price cannot be negative")
		}
	}
	// CHECK پایگاه داده همین را می‌گیرد، ولی خطایش یک پیام خام Postgres است
	// که مستقیم به ادمین نشان داده می‌شود (adminUpdateCompetition).
	if in.entryTarget() < 0 {
		return errors.New("entry target cannot be negative")
	}
	if !in.ClosesAt.After(in.OpensAt) {
		return errors.New("closing time must be after opening time")
	}
	return nil
}

func (s *Store) CreateCompetition(ctx context.Context, in CompetitionInput) (Competition, error) {
	if err := in.validate(); err != nil {
		return Competition{}, err
	}
	// ستون‌های بازنشستهٔ prize_id و ticket_price_cents عمداً نوشته نمی‌شوند.
	row := s.DB.QueryRow(ctx,
		`INSERT INTO competitions (slug, title, currency,
		     board_image, opens_at, closes_at, status, max_entries_user, entry_target)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING `+compColsBare,
		in.Slug, in.Title, in.Currency, in.BoardImage,
		in.OpensAt, in.ClosesAt, in.Status, in.MaxEntriesUser, in.entryTarget())
	c, err := scanComp(row)
	if err != nil {
		slog.Error("createCompetition", "error", err)
		return c, norm(err)
	}
	if err := s.SetCompetitionPrizes(ctx, c.ID, in.Prizes); err != nil {
		// مسابقه ساخته شده ولی بی‌جایزه است؛ نگهش نمی‌داریم تا ردیف ناقص
		// در فهرست ظاهر نشود.
		_, _ = s.DB.Exec(ctx, `DELETE FROM competitions WHERE id=$1`, c.ID)
		return Competition{}, norm(err)
	}
	c.Prizes, _ = s.CompetitionPrizes(ctx, c.ID, false)
	c.Prize = headlinePrize(c.Prizes)
	return c, nil
}

func (s *Store) UpdateCompetition(ctx context.Context, id uuid.UUID, in CompetitionInput) (Competition, error) {
	if err := in.validate(); err != nil {
		return Competition{}, err
	}
	// status عمداً نوشته *نمی‌شود*. مسیر تغییر وضعیت جداست
	// (SetCompetitionStatus / دکمه‌های چرخهٔ عمر) و آنجا هشدار مناسب داده
	// می‌شود. حالا که دوره می‌تواند خودکار بسته شود — با رسیدن به سقف، در
	// هر لحظه و بدون اقدام ادمین — فرمِ ویرایش همیشه یک status کهنه در دست
	// دارد؛ نوشتنش یعنی هر ذخیرهٔ بی‌ربط (اصلاح یک غلط تایپی) دوره‌ای را که
	// به داوری رفته بی‌صدا دوباره باز می‌کند.
	row := s.DB.QueryRow(ctx,
		`UPDATE competitions SET slug=$2, title=$3,
		     currency=$4, board_image=$5, opens_at=$6, closes_at=$7,
		     max_entries_user=$8, entry_target=$9
		 WHERE id=$1 RETURNING `+compColsBare,
		id, in.Slug, in.Title, in.Currency, in.BoardImage,
		in.OpensAt, in.ClosesAt, in.MaxEntriesUser, in.entryTarget())
	c, err := scanComp(row)
	if err != nil {
		return c, norm(err)
	}
	if err := s.SetCompetitionPrizes(ctx, c.ID, in.Prizes); err != nil {
		return c, norm(err)
	}
	c.Prizes, _ = s.CompetitionPrizes(ctx, c.ID, false)
	c.Prize = headlinePrize(c.Prizes)
	return c, nil
}

func (s *Store) SetCompetitionStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := s.DB.Exec(ctx, `UPDATE competitions SET status=$2 WHERE id=$1`, id, status)
	return err
}

func (s *Store) DeleteCompetition(ctx context.Context, id uuid.UUID) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM competitions WHERE id=$1`, id)
	return err
}

// CloseExpired مسابقاتی که زمانشان گذشته را می‌بندد. برای cron/کار زمان‌بندی‌شده.
//
// شرط judge_commits اینجا هم هست و دقیقاً با CloseAtTarget یکی است. نبودش
// بدترین حالتِ ممکن را می‌ساخت: دوره‌ای که هیچ داوری روی آن تعهد ثبت نکرده،
// سرِ closes_at بی‌قید بسته می‌شد و آن‌وقت نه Commit ممکن بود (فقط در
// open/draft مجاز است) نه Settle (ErrNoCommits) — یعنی بن‌بست دائمی. بازکردن
// دستی هم جواب نمی‌داد چون جاروی دقیقهٔ بعد دوباره می‌بستش.
//
// با این شرط، چنین دوره‌ای در وضعیت open می‌ماند تا هیئت داوران تعهدش را ثبت
// کند؛ پذیرش ورودی جداگانه با closes_at بسته می‌شود (هر دو مسیر ورود بازهٔ
// زمانی را مستقل بررسی می‌کنند)، پس «باز ماندن» به‌معنای فروشِ بیشتر نیست.
// چنین دوره‌ای در ListStuck برای ادمین قابل دیدن است.
func (s *Store) CloseExpired(ctx context.Context) (int64, error) {
	tag, err := s.DB.Exec(ctx,
		`UPDATE competitions c SET status='closed'
		 WHERE c.status='open' AND c.closes_at <= now()
		   AND EXISTS (SELECT 1 FROM judge_commits jc WHERE jc.competition_id = c.id)`)
	return tag.RowsAffected(), err
}

// StuckCompetitions دوره‌هایی که باید بسته می‌شدند ولی هیچ تعهد داوری ندارند.
//
// بدون این، شرطِ judge_commits یک انتظارِ خاموش می‌ساخت: دوره از نظر کاربر
// تمام شده (ورودی نمی‌پذیرد) ولی در هیچ فهرستی «منتظر اقدام» نبود، چون پنل
// داوری فقط closed/judging را نشان می‌دهد. این تابع همان شکاف را قابل دیدن
// می‌کند.
func (s *Store) StuckCompetitions(ctx context.Context) ([]Competition, error) {
	rows, err := s.DB.Query(ctx, fmt.Sprintf(
		`SELECT `+compCols+`, %s FROM competitions c
		 WHERE c.status='open'
		   AND (c.closes_at <= now()
		        OR (c.entry_target > 0 AND %s >= c.entry_target))
		   AND NOT EXISTS (SELECT 1 FROM judge_commits jc WHERE jc.competition_id = c.id)
		 ORDER BY c.closes_at`,
		fmt.Sprintf(countableEntries, "c.id"),
		fmt.Sprintf(countableEntries, "c.id")))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Competition{}
	for rows.Next() {
		var c Competition
		if err := rows.Scan(&c.ID, &c.Slug, &c.PrizeID, &c.Title, &c.TicketPriceCents, &c.Currency,
			&c.BoardImage, &c.OpensAt, &c.ClosesAt, &c.Status, &c.MaxEntriesUser, &c.EntryTarget,
			&c.CreatedAt, &c.EntryCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// دو پرسشِ متفاوت دربارهٔ «چند حدس در این دوره هست؟» وجود دارد و یکی‌گرفتنشان
// باعث بیش‌فروشی می‌شود. هر دو رشته با %s جای مسابقه را می‌گیرند تا هم با
// پارامتر ($1) و هم با ارجاع همبسته (c.id) کار کنند.
//
// ۱) «چند صندلی اشغال شده؟» → reservedEntries، برای گیتِ فروش.
// ۲) «چند حدسِ قطعی داریم؟» → countableEntries، برای بستنِ دوره.
//
// تفاوت در سفارش pending است. Checkout ورودی‌ها را کنار سفارشِ pending درج
// می‌کند، پس اگر گیتِ فروش هم pending را نشمارد، حدس‌هایی که همین الان فروخته
// شده‌اند برای خریدِ بعدی نامرئی‌اند و سقف بی‌صدا رد می‌شود: با سقف ۲۰٬۰۰۰
// می‌شد بی‌نهایت سبدِ pending باز کرد و همه از گیت رد می‌شدند.
//
// برعکسش هم درست نیست: بستنِ دوره نباید به pending تکیه کند، وگرنه یک اسکریپت
// با ۲۰٬۰۰۰ حدسِ پرداخت‌نشده کل مسابقه را زودرس می‌بندد.
//
// refunded/failed در هیچ‌کدام شمرده نمی‌شوند: صندلیِ سفارشِ برگشتی باید آزاد
// شود، وگرنه دوره‌ای که پولش برگشته همچنان پر به نظر می‌رسد.
const reservedEntries = `(SELECT count(*) FROM entries e
	 LEFT JOIN orders o ON o.id = e.order_id
	 WHERE e.competition_id = %s
	   AND (e.order_id IS NULL OR o.status IN ('pending','paid','free')))`

// countableEntries فقط حدس‌های قطعی: رایگان یا پرداخت‌شده. مبنای بستنِ دوره،
// نمایش پیشرفت، و انتخاب برنده.
const countableEntries = `(SELECT count(*) FROM entries e
	 LEFT JOIN orders o ON o.id = e.order_id
	 WHERE e.competition_id = %s
	   AND (e.order_id IS NULL OR o.status IN ('paid','free')))`

// countableEntryPredicate همان شرطِ «قطعی بودن» است، اما به‌شکل یک قید روی
// ردیفِ e برای استفاده در WHERE پرس‌وجوهای دیگر (انتخاب برنده، پاداش
// نزدیک‌ترین‌ها). با countableEntries یک تعریف دارد و باید با هم عوض شوند.
const countableEntryPredicate = `(e.order_id IS NULL OR EXISTS (
	 SELECT 1 FROM orders o WHERE o.id = e.order_id AND o.status IN ('paid','free')))`

// CloseAtTarget مسابقاتی که به سقف تعداد حدس رسیده‌اند را می‌بندد.
//
// این دومین شرط پایان یک دوره است، موازی با CloseExpired: هر کدام زودتر رخ
// دهد. «بسته» در این کدبیس دقیقاً یعنی آمادهٔ داوری — گیت Commit/Reveal/
// Settle همین وضعیت را می‌خواهد.
//
// جارو با وجود بررسی درون‌تراکنشیِ Checkout هم لازم است: آن بررسی فقط وقتی
// اجرا می‌شود که کسی خرید کند. اگر آخرین حدسِ لازم از مسیر ورود رایگان
// بیاید یا سقف را ادمین *پایین‌تر از تعداد فعلی* بیاورد، بدون این جارو
// مسابقه باز می‌ماند.
//
// همه‌چیز در یک UPDATE مجموعه‌ای انجام می‌شود تا بین شمارش و نوشتن فاصله‌ای
// برای رقابت همزمان نماند.
// دوره‌ای که هیچ داوری روی آن تعهد ثبت نکرده عمداً بسته نمی‌شود: Commit فقط
// در وضعیت open/draft مجاز است، پس بستنِ زودهنگام دوره را در بن‌بست
// ErrNoCommits رها می‌کند — نه قابل داوری، نه قابل تسویه. با ماندن در open،
// دوره حداکثر تا closes_at فرصت دارد تا پنل تعهدش را ثبت کند و CloseExpired
// در نهایت آن را می‌بندد.
func (s *Store) CloseAtTarget(ctx context.Context) (int64, error) {
	tag, err := s.DB.Exec(ctx, fmt.Sprintf(
		`UPDATE competitions c SET status='closed'
		 WHERE c.status='open' AND c.entry_target > 0
		   AND %s >= c.entry_target
		   AND EXISTS (SELECT 1 FROM judge_commits jc WHERE jc.competition_id = c.id)`,
		fmt.Sprintf(countableEntries, "c.id")))
	return tag.RowsAffected(), err
}
