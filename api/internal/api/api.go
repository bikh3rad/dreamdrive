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
	"dreamdrive/api/internal/storage"
	"dreamdrive/api/internal/store"
)

type Server struct {
	St   *store.Store
	Auth *auth.Manager
	// کلید مشترک با درگاه پرداخت برای بررسی امضای وب‌هوک.
	// خالی یعنی وب‌هوک پیکربندی نشده و مسیر ۵۰۳ برمی‌گرداند.
	WebhookSecret string
	// انبارهٔ فایل‌های آپلودی. nil یعنی آپلود غیرفعال است.
	Files storage.Store
}

func New(st *store.Store, am *auth.Manager, webhookSecret string, files storage.Store) *Server {
	return &Server{St: st, Auth: am, WebhookSecret: webhookSecret, Files: files}
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

	// انبارهٔ محلی فایل‌ها را خودش سرو می‌کند؛ در حالت S3 این بخش خالی است
	// چون خواندن مستقیماً از انباره یا CDN انجام می‌شود.
	if s.Files != nil {
		if prefix, h := s.Files.Handler(); h != nil {
			r.Handle(prefix+"*", h)
		}
	}

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

		// ---- ناظر مستقل ----
		// RequireExactRole نه RequireRole: superadmin عمداً استثنا نمی‌شود،
		// وگرنه مالک سیستم می‌توانست حادثهٔ یکپارچگیِ خودش را ببندد و قفل
		// تسویه را باز کند. ناظر باید حساب جدا داشته باشد.
		r.Route("/auditor", func(r chi.Router) {
			r.Use(s.Auth.Required, auth.RequireExactRole(auth.RoleAuditor))

			r.Get("/incidents", s.auditorIncidents)
			r.Post("/incidents/{id}/ack", s.auditorAck)
			r.Post("/incidents/{id}/resolve", s.auditorResolve)

			r.Get("/competitions", s.auditorCompetitions)
			// POST نه GET: این بررسی در صورت شکست، حادثه ثبت می‌کند. با GET
			// یک ناوبری ساده از سایت بیرونی (کوکی samesite=lax همراه می‌رود)
			// می‌توانست به نام ناظر قفل تسویه بیندازد.
			r.Post("/competitions/{id}/verify", s.auditorVerify)
			r.Post("/competitions/{id}/incidents", s.auditorRaise)
			r.Get("/competitions/{id}/panel", s.auditorPanel)
			r.Get("/audit", s.auditorAudit)
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
				// پیش از {id} ثبت شده و عمداً یک قطعهٔ ثابت است، نه
				// زیرمسیرِ یک شناسه؛ این فهرست به هیچ مسابقهٔ مشخصی تعلق
				// ندارد.
				r.Get("/competitions/stuck", s.adminStuckCompetitions)
				r.Post("/competitions", s.adminCreateCompetition)
				r.Put("/competitions/{id}", s.adminUpdateCompetition)
				r.Post("/competitions/{id}/status", s.adminSetStatus)
				r.Delete("/competitions/{id}", s.adminDeleteCompetition)

				r.Post("/uploads", s.uploadImage)

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
				r.Post("/competitions/{id}/verify", s.adminVerifyChain)
				r.Post("/competitions/{id}/settle", s.adminSettle)
				r.Post("/competitions/{id}/video", s.adminSetVideo)
			})
		})
	})

	return r
}
