package store

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ---------- Pages (CMS) ----------

func (s *Store) ListPages(ctx context.Context, onlyPublished bool) ([]Page, error) {
	q := `SELECT id, slug, title, body_md, published, updated_at FROM pages`
	if onlyPublished {
		q += ` WHERE published`
	}
	q += ` ORDER BY slug`
	rows, err := s.DB.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Page{}
	for rows.Next() {
		var p Page
		if err := rows.Scan(&p.ID, &p.Slug, &p.Title, &p.BodyMD, &p.Published, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) PageBySlug(ctx context.Context, slug string) (Page, error) {
	var p Page
	err := s.DB.QueryRow(ctx,
		`SELECT id, slug, title, body_md, published, updated_at FROM pages WHERE slug=$1`, slug).
		Scan(&p.ID, &p.Slug, &p.Title, &p.BodyMD, &p.Published, &p.UpdatedAt)
	return p, norm(err)
}

type PageInput struct {
	Slug      string `json:"slug"`
	Title     string `json:"title"`
	BodyMD    string `json:"body_md"`
	Published bool   `json:"published"`
}

// UpsertPage صفحه را بر اساس slug ایجاد یا به‌روزرسانی می‌کند.
func (s *Store) UpsertPage(ctx context.Context, in PageInput) (Page, error) {
	var p Page
	err := s.DB.QueryRow(ctx,
		`INSERT INTO pages (slug, title, body_md, published) VALUES ($1,$2,$3,$4)
		 ON CONFLICT (slug) DO UPDATE SET title=EXCLUDED.title, body_md=EXCLUDED.body_md,
		     published=EXCLUDED.published, updated_at=now()
		 RETURNING id, slug, title, body_md, published, updated_at`,
		in.Slug, in.Title, in.BodyMD, in.Published).
		Scan(&p.ID, &p.Slug, &p.Title, &p.BodyMD, &p.Published, &p.UpdatedAt)
	return p, norm(err)
}

func (s *Store) DeletePage(ctx context.Context, slug string) error {
	_, err := s.DB.Exec(ctx, `DELETE FROM pages WHERE slug=$1`, slug)
	return err
}

// ---------- Site settings (تم، منو، بنر) ----------

func (s *Store) Settings(ctx context.Context) (map[string]any, error) {
	rows, err := s.DB.Query(ctx, `SELECT key, value FROM site_settings`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]any{}
	for rows.Next() {
		var k string
		var v any
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		out[k] = v
	}
	return out, rows.Err()
}

func (s *Store) SetSetting(ctx context.Context, key string, value any) error {
	_, err := s.DB.Exec(ctx,
		`INSERT INTO site_settings (key, value) VALUES ($1,$2)
		 ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`, key, value)
	return err
}

// ---------- Audit ----------

func (s *Store) Audit(ctx context.Context, actor *uuid.UUID, action, target string, meta map[string]any, ip string) {
	if meta == nil {
		meta = map[string]any{}
	}
	// خطای لاگ نباید مسیر اصلی را بشکند
	_, _ = s.DB.Exec(ctx,
		`INSERT INTO audit_log (actor_id, action, target, meta, ip) VALUES ($1,$2,$3,$4,$5)`,
		actor, action, target, meta, ip)
}

func (s *Store) ListAudit(ctx context.Context, limit, offset int) ([]AuditEntry, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.DB.Query(ctx,
		`SELECT a.id, a.actor_id, COALESCE(u.email,''), a.action, a.target, a.meta, a.ip, a.created_at
		 FROM audit_log a LEFT JOIN users u ON u.id=a.actor_id
		 ORDER BY a.id DESC LIMIT $1 OFFSET $2`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AuditEntry{}
	for rows.Next() {
		var a AuditEntry
		if err := rows.Scan(&a.ID, &a.ActorID, &a.ActorEmail, &a.Action, &a.Target,
			&a.Meta, &a.IP, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ---------- Dashboard stats ----------

type Stats struct {
	Users          int64          `json:"users"`
	OpenComps      int64          `json:"open_competitions"`
	EntriesTotal   int64          `json:"entries_total"`
	RevenueCents   int64          `json:"revenue_cents"`
	Revenue30Cents int64          `json:"revenue_30d_cents"`
	Orders30       int64          `json:"orders_30d"`
	Daily          []DailyRevenue `json:"daily"`
}

type DailyRevenue struct {
	Day    time.Time `json:"day"`
	Cents  int64     `json:"cents"`
	Orders int64     `json:"orders"`
}

func (s *Store) Stats(ctx context.Context) (Stats, error) {
	var st Stats
	if err := s.DB.QueryRow(ctx,
		`SELECT (SELECT count(*) FROM users WHERE role='user'),
		        (SELECT count(*) FROM competitions WHERE status='open'),
		        (SELECT count(*) FROM entries),
		        (SELECT COALESCE(sum(total_cents),0) FROM orders WHERE status='paid'),
		        (SELECT COALESCE(sum(total_cents),0) FROM orders WHERE status='paid' AND paid_at > now() - interval '30 days'),
		        (SELECT count(*) FROM orders WHERE status='paid' AND paid_at > now() - interval '30 days')`,
	).Scan(&st.Users, &st.OpenComps, &st.EntriesTotal, &st.RevenueCents,
		&st.Revenue30Cents, &st.Orders30); err != nil {
		return st, err
	}

	rows, err := s.DB.Query(ctx,
		`SELECT date_trunc('day', paid_at) AS d, COALESCE(sum(total_cents),0), count(*)
		 FROM orders WHERE status='paid' AND paid_at > now() - interval '30 days'
		 GROUP BY d ORDER BY d`)
	if err != nil {
		return st, err
	}
	defer rows.Close()
	st.Daily = []DailyRevenue{}
	for rows.Next() {
		var d DailyRevenue
		if err := rows.Scan(&d.Day, &d.Cents, &d.Orders); err != nil {
			return st, err
		}
		st.Daily = append(st.Daily, d)
	}
	return st, rows.Err()
}

// RecentWinners برای صفحهٔ برندگان.
type Winner struct {
	CompetitionSlug  string    `json:"competition_slug"`
	CompetitionTitle string    `json:"competition_title"`
	PrizeTitle       string    `json:"prize_title"`
	HeroImage        string    `json:"hero_image"`
	WinnerName       string    `json:"winner_name"`
	Country          string    `json:"country"`
	VideoURL         string    `json:"video_url"`
	DecidedAt        time.Time `json:"decided_at"`
}

func (s *Store) RecentWinners(ctx context.Context, limit int) ([]Winner, error) {
	if limit <= 0 || limit > 100 {
		limit = 12
	}
	rows, err := s.DB.Query(ctx,
		`SELECT c.slug, c.title, p.title, p.hero_image,
		        -- نام نمایشی؛ اگر نام کامل نداریم هیچ بخشی از ایمیل منتشر نمی‌شود
		        COALESCE(NULLIF(u.full_name,''), 'برندهٔ تأییدشده'),
		        COALESCE(u.country,''), r.video_url, r.decided_at
		 FROM results r
		 JOIN competitions c ON c.id=r.competition_id
		 JOIN prizes p ON p.id=c.prize_id
		 LEFT JOIN users u ON u.id=r.winner_user_id
		 ORDER BY r.decided_at DESC LIMIT $1`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Winner{}
	for rows.Next() {
		var w Winner
		if err := rows.Scan(&w.CompetitionSlug, &w.CompetitionTitle, &w.PrizeTitle,
			&w.HeroImage, &w.WinnerName, &w.Country, &w.VideoURL, &w.DecidedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}
