// Package store لایهٔ دسترسی به PostgreSQL.
package store

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"dreamdrive/api/migrations"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	DB *pgxpool.Pool
}

func New(ctx context.Context, dsn string) (*Store, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.MaxConns = 10
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("connect: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("ping: %w", err)
	}
	return &Store{DB: pool}, nil
}

func (s *Store) Close() { s.DB.Close() }

// Migrate تمام فایل‌های SQL موجود در migrations را به ترتیب نام اجرا می‌کند.
func (s *Store) Migrate(ctx context.Context) error {
	entries, err := migrations.FS.ReadDir(".")
	if err != nil {
		return fmt.Errorf("read migrations: %w", err)
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	if _, err := s.DB.Exec(ctx,
		`CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
	); err != nil {
		return err
	}

	// قفل مشورتی در سطح کل پایگاه داده: اگر چند نمونهٔ API با هم بالا بیایند،
	// بدون این قفل هر دو شرط EXISTS را رد می‌کنند و هر دو بدنهٔ مهاجرت را
	// اجرا می‌کنند. بازندهٔ INSERT به خطای کلید تکراری می‌خورد و main با
	// log.Fatalf بالا نمی‌آید — و بدتر، بدنه دو بار اجرا شده است.
	//
	// قفل به اتصال گره خورده، پس باید روی یک اتصالِ مشخص گرفته و آزاد شود،
	// نه روی pool.
	conn, err := s.DB.Acquire(ctx)
	if err != nil {
		return err
	}
	defer conn.Release()

	const migrationLockKey = 8472351902347123 // ثابت دلخواه، فقط باید یکتا بماند
	if _, err := conn.Exec(ctx, `SELECT pg_advisory_lock($1)`, int64(migrationLockKey)); err != nil {
		return err
	}
	defer func() {
		// از ctx جدا می‌شود: اگر ctx لغو شده باشد، آزادکردن قفل هم شکست
		// می‌خورد و قفل تا بسته‌شدن اتصال می‌ماند.
		rctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if _, err := conn.Exec(rctx, `SELECT pg_advisory_unlock($1)`, int64(migrationLockKey)); err != nil {
			slog.Error("migrationUnlock", "error", err)
		}
	}()

	for _, name := range names {
		var exists bool
		if err := conn.QueryRow(ctx,
			`SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE name=$1)`, name,
		).Scan(&exists); err != nil {
			return err
		}
		if exists {
			continue
		}
		body, err := migrations.FS.ReadFile(name)
		if err != nil {
			return err
		}
		// بدنهٔ مهاجرت و ثبتِ نامش در یک تراکنش‌اند. پیش از این دو Exec جدا
		// بودند، یعنی یک خرابیِ بین آن دو باعث می‌شد مهاجرت اجرا شده ولی
		// ثبت‌نشده بماند و در بالاآمدنِ بعدی دوباره اجرا شود — برای فایلی که
		// UPDATE غیرخنثی دارد (مثل بازنشسته‌کردن قیمت‌های یورویی در ۰۰۰۵)
		// این یعنی بازنویسی دادهٔ درستِ امروز با قاعدهٔ دیروز.
		//
		// توجه: مهاجرتی که CREATE INDEX CONCURRENTLY دارد داخل تراکنش اجرا
		// نمی‌شود. اگر روزی لازم شد، باید مسیر جداگانه‌ای برایش گذاشت.
		tx, err := conn.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(body)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("migration %s: %w", name, err)
		}
	}
	return nil
}

func norm(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	return err
}
