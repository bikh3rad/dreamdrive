package store

import (
	"time"

	"github.com/google/uuid"
)

type User struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	FullName    string    `json:"full_name"`
	Country     string    `json:"country"`
	Role        string    `json:"role"`
	KYCStatus   string    `json:"kyc_status"`
	CreditCents int64     `json:"credit_cents"`
	IsBlocked   bool      `json:"is_blocked"`
	IsInsider   bool      `json:"is_insider"`
	CreatedAt   time.Time `json:"created_at"`

	PasswordHash string `json:"-"`
}

type Prize struct {
	ID         uuid.UUID      `json:"id"`
	Slug       string         `json:"slug"`
	Title      string         `json:"title"`
	Kind       string         `json:"kind"`
	Subtitle   string         `json:"subtitle"`
	BodyMD     string         `json:"body_md"`
	Spec       map[string]any `json:"spec"`
	ValueCents int64          `json:"value_cents"`
	HeroImage  string         `json:"hero_image"`
	Media      []PrizeMedia   `json:"media,omitempty"`
	CreatedAt  time.Time      `json:"created_at"`
}

type PrizeMedia struct {
	ID      uuid.UUID `json:"id"`
	URL     string    `json:"url"`
	Caption string    `json:"caption"`
	Sort    int       `json:"sort"`
}

type Competition struct {
	ID               uuid.UUID `json:"id"`
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
	CreatedAt        time.Time `json:"created_at"`

	Prize      *Prize `json:"prize,omitempty"`
	EntryCount int64  `json:"entry_count,omitempty"`
}

type Order struct {
	ID          uuid.UUID   `json:"id"`
	UserID      uuid.UUID   `json:"user_id"`
	UserEmail   string      `json:"user_email,omitempty"`
	TotalCents  int64       `json:"total_cents"`
	Currency    string      `json:"currency"`
	Status      string      `json:"status"`
	Provider    string      `json:"provider"`
	ProviderRef string      `json:"provider_ref"`
	CreatedAt   time.Time   `json:"created_at"`
	PaidAt      *time.Time  `json:"paid_at"`
	Items       []OrderItem `json:"items,omitempty"`
}

type OrderItem struct {
	ID              uuid.UUID `json:"id"`
	CompetitionID   uuid.UUID `json:"competition_id"`
	CompetitionSlug string    `json:"competition_slug,omitempty"`
	Title           string    `json:"title,omitempty"`
	Qty             int       `json:"qty"`
	UnitPriceCents  int64     `json:"unit_price_cents"`
}

type Entry struct {
	ID              uuid.UUID `json:"id"`
	UserID          uuid.UUID `json:"user_id"`
	CompetitionID   uuid.UUID `json:"competition_id"`
	CompetitionSlug string    `json:"competition_slug,omitempty"`
	X               float64   `json:"x"`
	Y               float64   `json:"y"`
	IsFreeEntry     bool      `json:"is_free_entry"`
	Seq             int64     `json:"seq"`
	Hash            string    `json:"hash"`
	CreatedAt       time.Time `json:"created_at"`
}

type Result struct {
	CompetitionID uuid.UUID  `json:"competition_id"`
	FinalX        float64    `json:"final_x"`
	FinalY        float64    `json:"final_y"`
	WinnerEntryID *uuid.UUID `json:"winner_entry_id"`
	WinnerUserID  *uuid.UUID `json:"winner_user_id"`
	WinnerEmail   string     `json:"winner_email,omitempty"`
	WinnerName    string     `json:"winner_name,omitempty"`
	Distance      float64    `json:"distance"`
	VideoURL      string     `json:"video_url"`
	DecidedAt     time.Time  `json:"decided_at"`
}

type Page struct {
	ID        uuid.UUID `json:"id"`
	Slug      string    `json:"slug"`
	Title     string    `json:"title"`
	BodyMD    string    `json:"body_md"`
	Published bool      `json:"published"`
	UpdatedAt time.Time `json:"updated_at"`
}

type AuditEntry struct {
	ID         int64          `json:"id"`
	ActorID    *uuid.UUID     `json:"actor_id"`
	ActorEmail string         `json:"actor_email,omitempty"`
	Action     string         `json:"action"`
	Target     string         `json:"target"`
	Meta       map[string]any `json:"meta"`
	IP         string         `json:"ip"`
	CreatedAt  time.Time      `json:"created_at"`
}

type JudgeStatus struct {
	JudgeID     uuid.UUID `json:"judge_id"`
	DisplayName string    `json:"display_name"`
	Committed   bool      `json:"committed"`
	Revealed    bool      `json:"revealed"`
	X           *float64  `json:"x,omitempty"`
	Y           *float64  `json:"y,omitempty"`
}
