package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/httpx"
	"dreamdrive/api/internal/store"
)

// ---------- احراز هویت ----------

type registerReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
	Country  string `json:"country"`
}

type authResp struct {
	Token string     `json:"token"`
	User  store.User `json:"user"`
}

func (s *Server) register(w http.ResponseWriter, r *http.Request) {
	var req registerReq
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if !strings.Contains(req.Email, "@") {
		httpx.Fail(w, 400, "a valid email address is required")
		return
	}
	if len(req.Password) < 8 {
		httpx.Fail(w, 400, "password must be at least 8 characters")
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		httpx.Fail(w, 500, "could not process password")
		return
	}
	u, err := s.St.CreateUser(r.Context(), req.Email, hash, req.FullName, req.Country, auth.RoleUser)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate") {
			httpx.Fail(w, 409, "an account with this email already exists")
			return
		}
		httpx.Fail(w, 500, "could not create account")
		return
	}

	tok, err := s.Auth.Issue(auth.Principal{ID: u.ID, Email: u.Email, Role: u.Role})
	if err != nil {
		httpx.Fail(w, 500, "could not issue token")
		return
	}
	s.St.Audit(r.Context(), &u.ID, "auth.register", u.Email, nil, httpx.ClientIP(r))
	httpx.JSON(w, 201, authResp{Token: tok, User: u})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	u, err := s.St.UserByEmail(r.Context(), strings.TrimSpace(req.Email))
	// پیام یکسان برای ایمیل ناموجود و رمز غلط تا حساب‌ها قابل شمارش نباشند
	if err != nil || !auth.CheckPassword(u.PasswordHash, req.Password) {
		httpx.Fail(w, 401, "incorrect email or password")
		return
	}
	if u.IsBlocked {
		httpx.Fail(w, 403, "this account has been suspended")
		return
	}
	tok, err := s.Auth.Issue(auth.Principal{ID: u.ID, Email: u.Email, Role: u.Role})
	if err != nil {
		httpx.Fail(w, 500, "could not issue token")
		return
	}
	s.St.Audit(r.Context(), &u.ID, "auth.login", u.Email, nil, httpx.ClientIP(r))
	httpx.JSON(w, 200, authResp{Token: tok, User: u})
}

// ---------- مسابقات ----------

func (s *Server) listCompetitions(w http.ResponseWriter, r *http.Request) {
	statuses := []string{"open"}
	if r.URL.Query().Get("include") == "all" {
		statuses = []string{"open", "closed", "judging", "settled"}
	}
	// مسیر عمومی: سطح بازنشسته اصلاً فرستاده نمی‌شود.
	comps, err := s.St.ListCompetitions(r.Context(), statuses, true, false)
	if err != nil {
		httpx.Fail(w, 500, "could not load competitions")
		return
	}
	httpx.JSON(w, 200, map[string]any{"competitions": comps})
}

func (s *Server) getCompetition(w http.ResponseWriter, r *http.Request) {
	c, err := s.St.CompetitionBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.Fail(w, 404, "competition not found")
		return
	}
	if c.Status == "draft" {
		httpx.Fail(w, 404, "competition not found")
		return
	}
	httpx.JSON(w, 200, c)
}

func (s *Server) getResult(w http.ResponseWriter, r *http.Request) {
	c, err := s.St.CompetitionBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil {
		httpx.Fail(w, 404, "competition not found")
		return
	}
	res, err := s.St.ResultFor(r.Context(), c.ID)
	if err != nil {
		httpx.Fail(w, 404, "no result has been published yet")
		return
	}
	// این پاسخ عمومی است: ایمیل کامل برنده منتشر نمی‌شود، فقط نام نمایشی
	// و شناسهٔ ورودی برنده که برای راستی‌آزمایی زنجیرهٔ هش کافی است.
	res.WinnerEmail = ""
	panel, _ := s.St.JudgePanel(r.Context(), c.ID)
	httpx.JSON(w, 200, map[string]any{"result": res, "panel": panel})
}

func (s *Server) listWinners(w http.ResponseWriter, r *http.Request) {
	ws, err := s.St.RecentWinners(r.Context(), 12)
	if err != nil {
		httpx.Fail(w, 500, "could not load winners")
		return
	}
	httpx.JSON(w, 200, map[string]any{"winners": ws})
}

func (s *Server) getPage(w http.ResponseWriter, r *http.Request) {
	p, err := s.St.PageBySlug(r.Context(), chi.URLParam(r, "slug"))
	if err != nil || !p.Published {
		httpx.Fail(w, 404, "page not found")
		return
	}
	httpx.JSON(w, 200, p)
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request) {
	set, err := s.St.Settings(r.Context())
	if err != nil {
		httpx.Fail(w, 500, "could not load settings")
		return
	}
	httpx.JSON(w, 200, set)
}

// ---------- کاربر ----------

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	u, err := s.St.UserByID(r.Context(), p.ID)
	if err != nil {
		httpx.Fail(w, 404, "account not found")
		return
	}
	httpx.JSON(w, 200, u)
}

func (s *Server) updateMe(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	var req struct {
		FullName string `json:"full_name"`
		Country  string `json:"country"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if _, err := s.St.DB.Exec(r.Context(),
		`UPDATE users SET full_name=$2, country=$3 WHERE id=$1`, p.ID, req.FullName, req.Country); err != nil {
		httpx.Fail(w, 500, "could not update profile")
		return
	}
	u, _ := s.St.UserByID(r.Context(), p.ID)
	httpx.JSON(w, 200, u)
}

func (s *Server) checkout(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	var req struct {
		Lines     []store.CartLine `json:"lines"`
		UseCredit bool             `json:"use_credit"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	res, err := s.St.Checkout(r.Context(), p.ID, req.Lines, "mock", req.UseCredit)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrCompetitionClosed):
			httpx.Fail(w, 409, "that competition is no longer open for entries")
		case errors.Is(err, store.ErrTargetReached):
			// پیام جدا از ErrEntryLimit: آنجا سهم خودِ کاربر تمام شده، اینجا
			// ظرفیت کل دوره پر شده و مشکلی از سمت کاربر نیست.
			httpx.Fail(w, 409, "ظرفیت این مسابقه تکمیل شده و وارد مرحلهٔ داوری می‌شود")
		case errors.Is(err, store.ErrEntryLimit):
			httpx.Fail(w, 409, "you have reached the entry limit for this competition")
		case errors.Is(err, store.ErrInsider), errors.Is(err, store.ErrBlocked):
			httpx.Fail(w, 403, err.Error())
		default:
			httpx.Fail(w, 400, err.Error())
		}
		return
	}
	s.St.Audit(r.Context(), &p.ID, "order.create", res.Order.ID.String(),
		map[string]any{"total_cents": res.Order.TotalCents, "entries": len(res.Entries)}, httpx.ClientIP(r))
	httpx.JSON(w, 201, res)
}

func (s *Server) freeEntry(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	// شرکت‌کنندهٔ رایگان هم جایزه‌اش را خودش انتخاب می‌کند؛ اگر این فیلد
	// اختیاری می‌شد، مسیر رایگان دیگر معادل مسیر پولی نبود.
	var req struct {
		Slug               string    `json:"competition_slug"`
		CompetitionPrizeID uuid.UUID `json:"competition_prize_id"`
		X                  float64   `json:"x"`
		Y                  float64   `json:"y"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if req.X < 0 || req.X > 1 || req.Y < 0 || req.Y > 1 {
		httpx.Fail(w, 400, "coordinates must be between 0 and 1")
		return
	}
	if req.CompetitionPrizeID == uuid.Nil {
		httpx.Fail(w, 400, "یک جایزه انتخاب کنید")
		return
	}
	e, err := s.St.FreeEntry(r.Context(), p.ID, req.Slug, req.CompetitionPrizeID, req.X, req.Y)
	if err != nil {
		switch {
		case errors.Is(err, store.ErrInsider), errors.Is(err, store.ErrBlocked):
			httpx.Fail(w, 403, err.Error())
		case errors.Is(err, store.ErrTargetReached):
			httpx.Fail(w, 409, "ظرفیت این مسابقه تکمیل شده و وارد مرحلهٔ داوری می‌شود")
		default:
			httpx.Fail(w, 409, err.Error())
		}
		return
	}
	s.St.Audit(r.Context(), &p.ID, "entry.free", req.Slug, nil, httpx.ClientIP(r))
	httpx.JSON(w, 201, e)
}

func (s *Server) myEntries(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	es, err := s.St.EntriesForUser(r.Context(), p.ID)
	if err != nil {
		httpx.Fail(w, 500, "could not load your entries")
		return
	}
	httpx.JSON(w, 200, map[string]any{"entries": es})
}

func (s *Server) myOrders(w http.ResponseWriter, r *http.Request) {
	p, _ := auth.From(r.Context())
	os, _, err := s.St.ListOrders(r.Context(), store.OrderFilter{UserID: &p.ID, Limit: 100})
	if err != nil {
		httpx.Fail(w, 500, "could not load your orders")
		return
	}
	httpx.JSON(w, 200, map[string]any{"orders": os})
}

// paymentWebhook تنها مسیر عمومی است که می‌تواند یک سفارش را «پرداخت‌شده»
// کند، پس بدون امضا رها نمی‌شود: هر کسی که شناسهٔ سفارشی را حدس بزند
// می‌توانست بلیط رایگان بگیرد. امضا HMAC-SHA256 روی بدنهٔ خام است و در
// هدر X-Signature می‌آید.
func (s *Server) paymentWebhook(w http.ResponseWriter, r *http.Request) {
	if s.WebhookSecret == "" {
		httpx.Fail(w, 503, "payment webhook is not configured")
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		httpx.Fail(w, 400, "invalid payload")
		return
	}
	mac := hmac.New(sha256.New, []byte(s.WebhookSecret))
	mac.Write(body)
	// امضا را رمزگشایی می‌کنیم تا بزرگی و کوچکی حروف hex اهمیتی نداشته باشد.
	got, err := hex.DecodeString(strings.TrimPrefix(r.Header.Get("X-Signature"), "sha256="))
	if err != nil || !hmac.Equal(mac.Sum(nil), got) {
		httpx.Fail(w, 401, "bad signature")
		return
	}

	var req struct {
		OrderID     string `json:"order_id"`
		ProviderRef string `json:"provider_ref"`
		Status      string `json:"status"`
	}
	// فرستنده با HMAC احراز شده؛ فیلدهای اضافیِ درگاه نباید باعث رد شوند.
	if err := httpx.DecodeBytesLoose(body, &req); err != nil {
		httpx.Fail(w, 400, "invalid payload")
		return
	}
	id, err := uuid.Parse(req.OrderID)
	if err != nil {
		httpx.Fail(w, 400, "invalid order id")
		return
	}
	if req.Status != "paid" {
		httpx.JSON(w, 200, map[string]string{"status": "ignored"})
		return
	}
	if err := s.St.MarkOrderPaid(r.Context(), id, req.ProviderRef); err != nil {
		httpx.Fail(w, 404, "order not found or already settled")
		return
	}
	s.St.Audit(r.Context(), nil, "payment.paid", req.OrderID,
		map[string]any{"ref": req.ProviderRef}, httpx.ClientIP(r))
	httpx.JSON(w, 200, map[string]string{"status": "ok"})
}
