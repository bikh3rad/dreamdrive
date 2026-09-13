package store

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

var (
	// ErrIncidentOpen وقتی تسویه به‌خاطر حادثهٔ رسیدگی‌نشده قفل است.
	ErrIncidentOpen = errors.New("settlement is locked: an unresolved integrity incident is on record for this competition")
)

// Incident یک حادثهٔ یکپارچگی. رکورد append-only است: تریگر دیتابیس اجازهٔ
// حذف یا تغییر فیلدهای واقعیت را نمی‌دهد (مهاجرت 0002).
type Incident struct {
	ID               int64      `json:"id"`
	CompetitionID    uuid.UUID  `json:"competition_id"`
	CompetitionSlug  string     `json:"competition_slug,omitempty"`
	CompetitionTitle string     `json:"competition_title,omitempty"`
	Kind             string     `json:"kind"`
	Detail           string     `json:"detail"`
	FirstBadSeq      int64      `json:"first_bad_seq"`
	CheckedCount     int64      `json:"checked_count"`
	DetectedAt       time.Time  `json:"detected_at"`
	Status           string     `json:"status"`
	AckBy            *uuid.UUID `json:"ack_by,omitempty"`
	AckByEmail       string     `json:"ack_by_email,omitempty"`
	AckAt            *time.Time `json:"ack_at,omitempty"`
	Resolution       string     `json:"resolution"`
	ResolvedBy       *uuid.UUID `json:"resolved_by,omitempty"`
	ResolvedAt       *time.Time `json:"resolved_at,omitempty"`
}

// RecordIncident یک حادثه ثبت می‌کند. اگر حادثهٔ بازی با همان نوع برای همان
// مسابقه وجود داشته باشد، ردیف تکراری ساخته نمی‌شود (ایندکس یکتای جزئی) و
// شناسهٔ حادثهٔ موجود برگردانده می‌شود — تا هر بار زدن دکمهٔ «اجرای بررسی»
// جدول ناظر را پر از ردیف یکسان نکند.
//
// استثنا: kind='manual' از ایندکس یکتا بیرون است (مهاجرت 0003). حادثهٔ
// خودکار یک *تشخیص تکراری* از یک واقعیت است، ولی هر نگرانیِ دستیِ ناظر
// واقعیت تازه‌ای است؛ اگر دوباره‌نشدن شامل manual می‌شد، متن دومی که ناظر
// می‌نوشت بی‌صدا دور ریخته می‌شد در حالی که به او گفته‌ایم ثبت دائمی است.
func (s *Store) RecordIncident(ctx context.Context, compID uuid.UUID,
	kind, detail string, firstBadSeq, checked int64) (int64, error) {

	var id int64
	err := s.DB.QueryRow(ctx,
		`INSERT INTO integrity_incidents
		     (competition_id, kind, detail, first_bad_seq, checked_count)
		 VALUES ($1,$2,$3,$4,$5)
		 ON CONFLICT DO NOTHING
		 RETURNING id`,
		compID, kind, detail, firstBadSeq, checked).Scan(&id)
	if err == nil {
		return id, nil
	}
	// ON CONFLICT DO NOTHING هیچ ردیفی برنمی‌گرداند، پس Scan خطای no-rows
	// می‌دهد؛ این یعنی حادثهٔ باز از قبل هست.
	if errors.Is(norm(err), ErrNotFound) {
		if e := s.DB.QueryRow(ctx,
			`SELECT id FROM integrity_incidents
			 WHERE competition_id=$1 AND kind=$2 AND status <> 'resolved'`,
			compID, kind).Scan(&id); e != nil {
			return 0, norm(e)
		}
		return id, nil
	}
	return 0, err
}

// HasOpenIncident آیا مسابقه حادثهٔ رسیدگی‌نشده دارد.
//
// هشدار: این تابع را به‌عنوان گیت تسویه استفاده نکن. روی pool اجرا می‌شود و
// بین خواندنش و Commit تسویه، حادثهٔ تازه نادیده می‌ماند. Settle عمداً همین
// شرط را درون تراکنش و پس از SELECT ... FOR UPDATE دوباره می‌خواند. این
// تابع فقط برای نمایش وضعیت است.
func (s *Store) HasOpenIncident(ctx context.Context, compID uuid.UUID) (bool, error) {
	var n int
	if err := s.DB.QueryRow(ctx,
		`SELECT count(*) FROM integrity_incidents
		 WHERE competition_id=$1 AND status <> 'resolved'`, compID).Scan(&n); err != nil {
		return false, err
	}
	return n > 0, nil
}

const incidentCols = `i.id, i.competition_id, c.slug, COALESCE(p.title, c.title),
	i.kind, i.detail, i.first_bad_seq, i.checked_count, i.detected_at, i.status,
	i.ack_by, COALESCE(ua.email,''), i.ack_at, i.resolution, i.resolved_by, i.resolved_at`

// ListIncidents حوادث را برمی‌گرداند. اگر onlyOpen باشد فقط رسیدگی‌نشده‌ها.
func (s *Store) ListIncidents(ctx context.Context, onlyOpen bool, limit int) ([]Incident, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.DB.Query(ctx,
		`SELECT `+incidentCols+`
		 FROM integrity_incidents i
		 JOIN competitions c ON c.id=i.competition_id
		 LEFT JOIN prizes p ON p.id=c.prize_id
		 LEFT JOIN users ua ON ua.id=i.ack_by
		 WHERE ($1 = FALSE OR i.status <> 'resolved')
		 ORDER BY i.id DESC LIMIT $2`, onlyOpen, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Incident{}
	for rows.Next() {
		var in Incident
		if err := rows.Scan(&in.ID, &in.CompetitionID, &in.CompetitionSlug,
			&in.CompetitionTitle, &in.Kind, &in.Detail, &in.FirstBadSeq,
			&in.CheckedCount, &in.DetectedAt, &in.Status, &in.AckBy,
			&in.AckByEmail, &in.AckAt, &in.Resolution, &in.ResolvedBy,
			&in.ResolvedAt); err != nil {
			return nil, err
		}
		out = append(out, in)
	}
	return out, rows.Err()
}

// AcknowledgeIncident ناظر حادثه را دیده و در حال بررسی است.
func (s *Store) AcknowledgeIncident(ctx context.Context, id int64, auditorID uuid.UUID) error {
	tag, err := s.DB.Exec(ctx,
		`UPDATE integrity_incidents
		    SET status='acknowledged', ack_by=$2, ack_at=now()
		  WHERE id=$1 AND status='open'`, id, auditorID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("incident %d is not in the open state", id)
	}
	return nil
}

// ResolveIncident بستن حادثه با توضیح مکتوب. توضیح اجباری است: حادثه‌ای که
// بدون دلیل بسته شود همان‌قدر بی‌ارزش است که اصلاً ثبت نشده باشد.
func (s *Store) ResolveIncident(ctx context.Context, id int64, auditorID uuid.UUID, resolution string) error {
	// TrimSpace پیش از شمارش، تا با قید btrim در تریگر پایگاه‌داده یکی باشد؛
	// وگرنه بیست فاصله از این بررسی رد می‌شد و در تریگر خطای مبهم می‌داد.
	resolution = strings.TrimSpace(resolution)
	if len([]rune(resolution)) < 20 {
		return errors.New("a written resolution of at least 20 characters is required")
	}
	tag, err := s.DB.Exec(ctx,
		`UPDATE integrity_incidents
		    SET status='resolved', resolution=$3, resolved_by=$2, resolved_at=now()
		  WHERE id=$1 AND status <> 'resolved'`, id, auditorID, resolution)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("incident %d is already resolved", id)
	}
	return nil
}
