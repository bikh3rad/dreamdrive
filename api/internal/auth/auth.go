// Package auth احراز هویت JWT، هش رمز و میان‌افزار نقش‌ها.
package auth

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"dreamdrive/api/internal/httpx"
)

type ctxKey string

const userCtxKey ctxKey = "dd_user"

// نقش‌ها
const (
	RoleUser         = "user"
	RoleSupport      = "support"
	RoleContentAdmin = "content_admin"
	RoleFinanceAdmin = "finance_admin"
	RoleSuperAdmin   = "superadmin"
	RoleJudge        = "judge"
	// RoleAuditor ناظر مستقل: فقط می‌خواند و حوادث یکپارچگی را رسیدگی
	// می‌کند. عمداً در AdminRoles نیست — اگر ناظر به پنل مدیریت دسترسی
	// داشته باشد، دیگر مستقل از چیزی که بر آن نظارت می‌کند نیست.
	RoleAuditor = "auditor"
)

// AdminRoles نقش‌هایی که به هر بخشی از پنل ادمین دسترسی دارند.
var AdminRoles = []string{RoleSupport, RoleContentAdmin, RoleFinanceAdmin, RoleSuperAdmin}

type Principal struct {
	ID    uuid.UUID
	Email string
	Role  string
}

type Manager struct {
	secret []byte
	ttl    time.Duration
}

func NewManager(secret string) *Manager {
	return &Manager{secret: []byte(secret), ttl: 7 * 24 * time.Hour}
}

func HashPassword(pw string) (string, error) {
	b, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	return string(b), err
}

func CheckPassword(hash, pw string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(pw)) == nil
}

func (m *Manager) Issue(p Principal) (string, error) {
	claims := jwt.MapClaims{
		"sub":   p.ID.String(),
		"email": p.Email,
		"role":  p.Role,
		"exp":   time.Now().Add(m.ttl).Unix(),
		"iat":   time.Now().Unix(),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

func (m *Manager) Parse(tokenStr string) (Principal, error) {
	var p Principal
	tok, err := jwt.Parse(tokenStr, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return m.secret, nil
	})
	if err != nil || !tok.Valid {
		return p, errors.New("invalid token")
	}
	claims, ok := tok.Claims.(jwt.MapClaims)
	if !ok {
		return p, errors.New("invalid claims")
	}
	id, err := uuid.Parse(str(claims["sub"]))
	if err != nil {
		return p, errors.New("invalid subject")
	}
	p.ID, p.Email, p.Role = id, str(claims["email"]), str(claims["role"])
	return p, nil
}

func str(v any) string {
	s, _ := v.(string)
	return s
}

// Optional اگر توکن معتبر بود کاربر را در context می‌گذارد، ولی درخواست را رد نمی‌کند.
func (m *Manager) Optional(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if tok := bearer(r); tok != "" {
			if p, err := m.Parse(tok); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), userCtxKey, p))
			}
		}
		next.ServeHTTP(w, r)
	})
}

// Required ورود اجباری.
func (m *Manager) Required(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tok := bearer(r)
		if tok == "" {
			httpx.Fail(w, http.StatusUnauthorized, "authentication required")
			return
		}
		p, err := m.Parse(tok)
		if err != nil {
			httpx.Fail(w, http.StatusUnauthorized, "invalid or expired token")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), userCtxKey, p)))
	})
}

// RequireRole دسترسی را به نقش‌های مشخص محدود می‌کند. superadmin همیشه مجاز است.
func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]bool{RoleSuperAdmin: true}
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := From(r.Context())
			if !ok {
				httpx.Fail(w, http.StatusUnauthorized, "authentication required")
				return
			}
			if !allowed[p.Role] {
				httpx.Fail(w, http.StatusForbidden, "insufficient permissions")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

// RequireExactRole مثل RequireRole است با یک تفاوت حیاتی: superadmin استثنا
// نمی‌شود. برای مسیرهای ناظر مستقل لازم است — اگر superadmin بتواند خودش را
// جای ناظر بگذارد و حادثهٔ یکپارچگی را «رسیدگی‌شده» علامت بزند، کل سازوکار
// نظارت بی‌معنی می‌شود و آن وقت دوباره همان کسی که مظنون است تصمیم‌گیرنده
// هم هست. مالک سیستم برای نظارت باید حساب auditor جداگانه بسازد.
func RequireExactRole(roles ...string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			p, ok := From(r.Context())
			if !ok {
				httpx.Fail(w, http.StatusUnauthorized, "authentication required")
				return
			}
			if !allowed[p.Role] {
				httpx.Fail(w, http.StatusForbidden, "this area is restricted to the independent auditor")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func From(ctx context.Context) (Principal, bool) {
	p, ok := ctx.Value(userCtxKey).(Principal)
	return p, ok
}

func bearer(r *http.Request) string {
	h := r.Header.Get("Authorization")
	if strings.HasPrefix(strings.ToLower(h), "bearer ") {
		return strings.TrimSpace(h[7:])
	}
	if c, err := r.Cookie("dd_token"); err == nil {
		return c.Value
	}
	return ""
}
