package store

import (
	"context"

	"github.com/google/uuid"
)

const userCols = `id, email, password_hash, full_name, country, role, kyc_status,
	credit_cents, is_blocked, is_insider, created_at`

func scanUser(row interface{ Scan(...any) error }) (User, error) {
	var u User
	err := row.Scan(&u.ID, &u.Email, &u.PasswordHash, &u.FullName, &u.Country,
		&u.Role, &u.KYCStatus, &u.CreditCents, &u.IsBlocked, &u.IsInsider, &u.CreatedAt)
	return u, err
}

func (s *Store) CreateUser(ctx context.Context, email, hash, fullName, country, role string) (User, error) {
	row := s.DB.QueryRow(ctx,
		`INSERT INTO users (email, password_hash, full_name, country, role)
		 VALUES (lower($1), $2, $3, $4, $5) RETURNING `+userCols,
		email, hash, fullName, country, role)
	u, err := scanUser(row)
	return u, norm(err)
}

func (s *Store) UserByEmail(ctx context.Context, email string) (User, error) {
	row := s.DB.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE email = lower($1)`, email)
	u, err := scanUser(row)
	return u, norm(err)
}

func (s *Store) UserByID(ctx context.Context, id uuid.UUID) (User, error) {
	row := s.DB.QueryRow(ctx, `SELECT `+userCols+` FROM users WHERE id = $1`, id)
	u, err := scanUser(row)
	return u, norm(err)
}

type UserFilter struct {
	Search string
	Role   string
	Limit  int
	Offset int
}

func (s *Store) ListUsers(ctx context.Context, f UserFilter) ([]User, int64, error) {
	if f.Limit <= 0 || f.Limit > 200 {
		f.Limit = 50
	}
	var total int64
	if err := s.DB.QueryRow(ctx,
		`SELECT count(*) FROM users
		 WHERE ($1 = '' OR email ILIKE '%'||$1||'%' OR full_name ILIKE '%'||$1||'%')
		   AND ($2 = '' OR role = $2)`, f.Search, f.Role).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := s.DB.Query(ctx,
		`SELECT `+userCols+` FROM users
		 WHERE ($1 = '' OR email ILIKE '%'||$1||'%' OR full_name ILIKE '%'||$1||'%')
		   AND ($2 = '' OR role = $2)
		 ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
		f.Search, f.Role, f.Limit, f.Offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	out := []User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, u)
	}
	return out, total, rows.Err()
}

// UserPatch یک به‌روزرسانی جزئی است: هر فیلد nil یعنی «دست نزن».
// پنل مدیریت هر تغییر را جداگانه می‌فرستد (فقط نقش، فقط KYC، …) و
// بدون اشاره‌گر، فیلدهای نافرستاده با مقدار صفر بازنویسی می‌شدند.
type UserPatch struct {
	Role      *string `json:"role"`
	KYCStatus *string `json:"kyc_status"`
	IsBlocked *bool   `json:"is_blocked"`
	IsInsider *bool   `json:"is_insider"`
}

func (s *Store) UpdateUserAdmin(ctx context.Context, id uuid.UUID, p UserPatch) (User, error) {
	row := s.DB.QueryRow(ctx,
		`UPDATE users SET
		   role       = COALESCE($2, role),
		   kyc_status = COALESCE($3, kyc_status),
		   is_blocked = COALESCE($4, is_blocked),
		   is_insider = COALESCE($5, is_insider)
		 WHERE id=$1 RETURNING `+userCols,
		id, p.Role, p.KYCStatus, p.IsBlocked, p.IsInsider)
	u, err := scanUser(row)
	return u, norm(err)
}

func (s *Store) AddCredit(ctx context.Context, id uuid.UUID, cents int64) error {
	_, err := s.DB.Exec(ctx, `UPDATE users SET credit_cents = credit_cents + $2 WHERE id=$1`, id, cents)
	return err
}

func (s *Store) ListJudges(ctx context.Context) ([]User, error) {
	rows, err := s.DB.Query(ctx, `SELECT `+userCols+` FROM users WHERE role='judge' ORDER BY full_name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []User{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}
