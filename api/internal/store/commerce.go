package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

var (
	ErrCompetitionClosed = errors.New("competition is not open")
	ErrEntryLimit        = errors.New("entry limit reached for this competition")
	ErrInsider           = errors.New("insiders may not enter competitions")
	ErrBlocked           = errors.New("account is blocked")
)

// CartLine یک قلم از سبد خرید: چند بلیط برای یک مسابقه، هر بلیط با مختصات خودش.
type CartLine struct {
	CompetitionSlug string  `json:"competition_slug"`
	Picks           []Point `json:"picks"`
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

	var total int64
	type prepared struct {
		comp  Competition
		picks []Point
	}
	preps := make([]prepared, 0, len(lines))

	for _, line := range lines {
		if len(line.Picks) == 0 {
			continue
		}
		// قفل سطر مسابقه تا شمارش ورودی‌ها در برابر رقابت همزمان امن بماند
		var c Competition
		r := tx.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.slug=$1 FOR UPDATE`, line.CompetitionSlug)
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
			if existing+len(line.Picks) > c.MaxEntriesUser {
				return res, fmt.Errorf("%w: %s", ErrEntryLimit, c.Slug)
			}
		}
		for _, p := range line.Picks {
			if p.X < 0 || p.X > 1 || p.Y < 0 || p.Y > 1 {
				return res, errors.New("coordinates must be normalised between 0 and 1")
			}
		}
		total += c.TicketPriceCents * int64(len(line.Picks))
		preps = append(preps, prepared{comp: c, picks: line.Picks})
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
			`INSERT INTO order_items (order_id, competition_id, qty, unit_price_cents)
			 VALUES ($1,$2,$3,$4)`,
			ord.ID, p.comp.ID, len(p.picks), p.comp.TicketPriceCents); err != nil {
			return res, err
		}
		for _, pick := range p.picks {
			e, err := insertEntry(ctx, tx, userID, p.comp.ID, &ord.ID, pick.X, pick.Y, false)
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

	if err := tx.Commit(ctx); err != nil {
		return res, err
	}
	ord.Status = status
	res.Order = ord
	return res, nil
}

// insertEntry ورودی را با زنجیرهٔ هش (prev_hash → hash) ثبت می‌کند تا دستکاریِ
// گذشته قابل تشخیص باشد. باید داخل تراکنشی اجرا شود که سطر مسابقه را قفل کرده است.
func insertEntry(ctx context.Context, tx pgx.Tx, userID, compID uuid.UUID, orderID *uuid.UUID, x, y float64, free bool) (Entry, error) {
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
		`INSERT INTO entries (id, user_id, competition_id, order_id, x, y, is_free_entry, seq, prev_hash, hash, created_at)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		 RETURNING id, user_id, competition_id, x, y, is_free_entry, seq, hash, created_at`,
		id, userID, compID, orderID, x, y, free, seq, prevHash, h, createdAt,
	).Scan(&e.ID, &e.UserID, &e.CompetitionID, &e.X, &e.Y, &e.IsFreeEntry, &e.Seq, &e.Hash, &e.CreatedAt)
	return e, err
}

// FreeEntry مسیر ورود رایگان (سپر حقوقی) — بدون سفارش، محدود به یک بار در هفته.
func (s *Store) FreeEntry(ctx context.Context, userID uuid.UUID, slug string, x, y float64) (Entry, error) {
	var e Entry
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return e, err
	}
	defer tx.Rollback(ctx)

	c, err := scanComp(tx.QueryRow(ctx, `SELECT `+compCols+` FROM competitions c WHERE c.slug=$1 FOR UPDATE`, slug))
	if err != nil {
		return e, norm(err)
	}
	if c.Status != "open" {
		return e, ErrCompetitionClosed
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
	if e, err = insertEntry(ctx, tx, userID, c.ID, nil, x, y, true); err != nil {
		return e, err
	}
	e.CompetitionSlug = c.Slug
	return e, tx.Commit(ctx)
}

// MarkOrderPaid وب‌هوک درگاه پرداخت.
func (s *Store) MarkOrderPaid(ctx context.Context, orderID uuid.UUID, providerRef string) error {
	tag, err := s.DB.Exec(ctx,
		`UPDATE orders SET status='paid', paid_at=now(), provider_ref=$2
		 WHERE id=$1 AND status='pending'`, orderID, providerRef)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
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
		`SELECT oi.order_id, oi.id, oi.competition_id, c.slug, c.title, oi.qty, oi.unit_price_cents
		 FROM order_items oi JOIN competitions c ON c.id=oi.competition_id
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
			&it.Title, &it.Qty, &it.UnitPriceCents); err != nil {
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
