// Package api روتر و هندلرهای HTTP.
package api

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/httpx"
	"dreamdrive/api/internal/store"
)

type Server struct {
	St   *store.Store
	Auth *auth.Manager
	// کلید مشترک با درگاه پرداخت برای بررسی امضای وب‌هوک.
	// خالی یعنی وب‌هوک پیکربندی نشده و مسیر ۵۰۳ برمی‌گرداند.
	WebhookSecret string
}

func New(st *store.Store, am *auth.Manager, webhookSecret string) *Server {
	return &Server{St: st, Auth: am, WebhookSecret: webhookSecret}
}

func (s *Server) Router(corsOrigin string) http.Handler {
	r := chi.NewRouter()
	r.Use(middleware.RequestID, middleware.RealIP, middleware.Logger, middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{corsOrigin},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Authorization", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.JSON(w, 200, map[string]string{"status": "ok"})
	})

	r.Route("/api", func(r chi.Router) {
		// ---- عمومی ----
		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Optional)
			r.Post("/auth/register", s.register)
			r.Post("/auth/login", s.login)
			r.Get("/competitions", s.listCompetitions)
			r.Get("/competitions/{slug}", s.getCompetition)
			r.Get("/competitions/{slug}/result", s.getResult)
			r.Get("/winners", s.listWinners)
			r.Get("/pages/{slug}", s.getPage)
			r.Get("/settings", s.getSettings)
		})

		// ---- کاربر واردشده ----
		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Required)
			r.Get("/me", s.me)
			r.Patch("/me", s.updateMe)
			r.Post("/checkout", s.checkout)
			r.Post("/free-entry", s.freeEntry)
			r.Get("/me/entries", s.myEntries)
			r.Get("/me/orders", s.myOrders)
		})

		// ---- درگاه پرداخت (وب‌هوک) ----
		r.Post("/payments/webhook", s.paymentWebhook)

		// ---- داور ----
		r.Group(func(r chi.Router) {
			r.Use(s.Auth.Required, auth.RequireRole(auth.RoleJudge))
			r.Get("/judge/competitions", s.judgeCompetitions)
			r.Post("/judge/{id}/commit", s.judgeCommit)
			r.Post("/judge/{id}/reveal", s.judgeReveal)
		})

		// ---- ادمین ----
		r.Route("/admin", func(r chi.Router) {
			r.Use(s.Auth.Required, auth.RequireRole(auth.AdminRoles...))

			r.Get("/stats", s.adminStats)
			r.Get("/audit", s.adminAudit)

			// محتوا
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(auth.RoleContentAdmin))
				r.Get("/prizes", s.adminListPrizes)
				r.Post("/prizes", s.adminCreatePrize)
				r.Put("/prizes/{id}", s.adminUpdatePrize)
				r.Delete("/prizes/{id}", s.adminDeletePrize)
				r.Post("/prizes/{id}/media", s.adminAddMedia)
				r.Delete("/media/{id}", s.adminDeleteMedia)

				r.Get("/competitions", s.adminListCompetitions)
				r.Post("/competitions", s.adminCreateCompetition)
				r.Put("/competitions/{id}", s.adminUpdateCompetition)
				r.Post("/competitions/{id}/status", s.adminSetStatus)
				r.Delete("/competitions/{id}", s.adminDeleteCompetition)

				r.Get("/pages", s.adminListPages)
				r.Put("/pages", s.adminUpsertPage)
				r.Delete("/pages/{slug}", s.adminDeletePage)

				r.Put("/settings", s.adminSetSettings)
			})

			// کاربران
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(auth.RoleSupport))
				r.Get("/users", s.adminListUsers)
				r.Patch("/users/{id}", s.adminUpdateUser)
				r.Post("/users/{id}/credit", s.adminAddCredit)
			})

			// مالی
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(auth.RoleFinanceAdmin))
				r.Get("/orders", s.adminListOrders)
				r.Post("/orders/{id}/refund", s.adminRefund)
			})

			// داوری و تسویه
			r.Group(func(r chi.Router) {
				r.Use(auth.RequireRole(auth.RoleSuperAdmin))
				r.Get("/competitions/{id}/panel", s.adminPanel)
				r.Get("/competitions/{id}/entries", s.adminEntries)
				r.Get("/competitions/{id}/verify", s.adminVerifyChain)
				r.Post("/competitions/{id}/settle", s.adminSettle)
				r.Post("/competitions/{id}/video", s.adminSetVideo)
			})
		})
	})

	return r
}
