package store

import (
	"context"
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
const compCols = `c.id, c.slug, c.prize_id, c.title, c.ticket_price_cents, c.currency,
	c.board_image, c.opens_at, c.closes_at, c.status, c.max_entries_user, c.created_at`

// compColsBare برای RETURNING در INSERT و UPDATE.
const compColsBare = `id, slug, prize_id, title, ticket_price_cents, currency,
	board_image, opens_at, closes_at, status, max_entries_user, created_at`

func scanComp(row interface{ Scan(...any) error }) (Competition, error) {
	var c Competition
	err := row.Scan(&c.ID, &c.Slug, &c.PrizeID, &c.Title, &c.TicketPriceCents, &c.Currency,
		&c.BoardImage, &c.OpensAt, &c.ClosesAt, &c.Status, &c.MaxEntriesUser, &c.CreatedAt)
	return c, err
}

// ListCompetitions اگر statuses خالی باشد همه را برمی‌گرداند.
func (s *Store) ListCompetitions(ctx context.Context, statuses []string, withPrize bool) ([]Competition, error) {
	q := `SELECT ` + compCols + `, (SELECT count(*) FROM entries e WHERE e.competition_id=c.id)
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
			&c.BoardImage, &c.OpensAt, &c.ClosesAt, &c.Status, &c.MaxEntriesUser, &c.CreatedAt,
			&c.EntryCount); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if withPrize {
		for i := range out {
			p, err := s.PrizeByID(ctx, out[i].PrizeID)
			if err == nil {
				out[i].Prize = &p
			}
		}
	}
	return out, nil
}

func (s *Store) CompetitionBySlug(ctx context.Context, slug string) (Competition, error) {
	c, err := scanComp(s.DB.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.slug=$1`, slug))
	if err != nil {
		return c, norm(err)
	}
	p, err := s.PrizeByID(ctx, c.PrizeID)
	if err == nil {
		c.Prize = &p
	}
	_ = s.DB.QueryRow(ctx, `SELECT count(*) FROM entries WHERE competition_id=$1`, c.ID).Scan(&c.EntryCount)
	return c, nil
}

func (s *Store) CompetitionByID(ctx context.Context, id uuid.UUID) (Competition, error) {
	c, err := scanComp(s.DB.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.id=$1`, id))
	return c, norm(err)
}

type CompetitionInput struct {
	Slug             string    `json:"slug"`
	PrizeID          uuid.UUID `json:"prize_id"`
	Title            string    `json:"title"`
	TicketPriceCents int64     `json:"ticket_price_cents"`
	Currency         string    `json:"currency"`
	BoardImage       string    `json:"board_image"`
	OpensAt          time.Time `json:"opens_at"`
	ClosesAt         time.Time `json:"closes_at"`
	Status           string    `json:"status"`
	MaxEntriesUser   int       `json:"max_entries_user"`
}

func (s *Store) CreateCompetition(ctx context.Context, in CompetitionInput) (Competition, error) {
	row := s.DB.QueryRow(ctx,
		`INSERT INTO competitions (slug, prize_id, title, ticket_price_cents, currency,
		     board_image, opens_at, closes_at, status, max_entries_user)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING `+compColsBare,
		in.Slug, in.PrizeID, in.Title, in.TicketPriceCents, in.Currency, in.BoardImage,
		in.OpensAt, in.ClosesAt, in.Status, in.MaxEntriesUser)
	c, err := scanComp(row)
	return c, norm(err)
}

func (s *Store) UpdateCompetition(ctx context.Context, id uuid.UUID, in CompetitionInput) (Competition, error) {
	row := s.DB.QueryRow(ctx,
		`UPDATE competitions SET slug=$2, prize_id=$3, title=$4, ticket_price_cents=$5,
		     currency=$6, board_image=$7, opens_at=$8, closes_at=$9, status=$10, max_entries_user=$11
		 WHERE id=$1 RETURNING `+compColsBare,
		id, in.Slug, in.PrizeID, in.Title, in.TicketPriceCents, in.Currency, in.BoardImage,
		in.OpensAt, in.ClosesAt, in.Status, in.MaxEntriesUser)
	c, err := scanComp(row)
	return c, norm(err)
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
func (s *Store) CloseExpired(ctx context.Context) (int64, error) {
	tag, err := s.DB.Exec(ctx,
		`UPDATE competitions SET status='closed' WHERE status='open' AND closes_at <= now()`)
	return tag.RowsAffected(), err
}
