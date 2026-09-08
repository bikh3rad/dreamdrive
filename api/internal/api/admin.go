package api

import (
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/httpx"
	"dreamdrive/api/internal/store"
)

func pathID(r *http.Request) (uuid.UUID, bool) {
	id, err := uuid.Parse(chi.URLParam(r, "id"))
	return id, err == nil
}

func qInt(r *http.Request, key string, def int) int {
	if v := r.URL.Query().Get(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

// ---------- داشبورد ----------

func (s *Server) adminStats(w http.ResponseWriter, r *http.Request) {
	st, err := s.St.Stats(r.Context())
	if err != nil {
		httpx.Fail(w, 500, "could not load statistics")
		return
	}
	httpx.JSON(w, 200, st)
}

func (s *Server) adminAudit(w http.ResponseWriter, r *http.Request) {
	rows, err := s.St.ListAudit(r.Context(), qInt(r, "limit", 100), qInt(r, "offset", 0))
	if err != nil {
		httpx.Fail(w, 500, "could not load audit log")
		return
	}
	httpx.JSON(w, 200, map[string]any{"entries": rows})
}

// ---------- جوایز ----------

func (s *Server) adminListPrizes(w http.ResponseWriter, r *http.Request) {
	ps, err := s.St.ListPrizes(r.Context())
	if err != nil {
		httpx.Fail(w, 500, "could not load prizes")
		return
	}
	httpx.JSON(w, 200, map[string]any{"prizes": ps})
}

func (s *Server) adminCreatePrize(w http.ResponseWriter, r *http.Request) {
	var in store.PrizeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if in.Slug == "" || in.Title == "" {
		httpx.Fail(w, 400, "slug and title are required")
		return
	}
	p, err := s.St.CreatePrize(r.Context(), in)
	if err != nil {
		httpx.Fail(w, 400, "could not create prize: "+err.Error())
		return
	}
	s.audit(r, "prize.create", p.Slug, nil)
	httpx.JSON(w, 201, p)
}

func (s *Server) adminUpdatePrize(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in store.PrizeInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	p, err := s.St.UpdatePrize(r.Context(), id, in)
	if err != nil {
		httpx.Fail(w, 400, "could not update prize")
		return
	}
	s.audit(r, "prize.update", p.Slug, nil)
	httpx.JSON(w, 200, p)
}

func (s *Server) adminDeletePrize(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	if err := s.St.DeletePrize(r.Context(), id); err != nil {
		httpx.Fail(w, 409, "prize is still referenced by a competition")
		return
	}
	s.audit(r, "prize.delete", id.String(), nil)
	httpx.JSON(w, 204, nil)
}

func (s *Server) adminAddMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in struct {
		URL     string `json:"url"`
		Caption string `json:"caption"`
		Sort    int    `json:"sort"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if err := s.St.AddPrizeMedia(r.Context(), id, in.URL, in.Caption, in.Sort); err != nil {
		httpx.Fail(w, 400, "could not add media")
		return
	}
	s.audit(r, "prize.media.add", id.String(), map[string]any{"url": in.URL})
	httpx.JSON(w, 201, map[string]string{"status": "ok"})
}

func (s *Server) adminDeleteMedia(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	_ = s.St.DeletePrizeMedia(r.Context(), id)
	s.audit(r, "prize.media.delete", id.String(), nil)
	httpx.JSON(w, 204, nil)
}

// ---------- مسابقات ----------

func (s *Server) adminListCompetitions(w http.ResponseWriter, r *http.Request) {
	comps, err := s.St.ListCompetitions(r.Context(), nil, true)
	if err != nil {
		httpx.Fail(w, 500, "could not load competitions")
		return
	}
	httpx.JSON(w, 200, map[string]any{"competitions": comps})
}

func (s *Server) adminCreateCompetition(w http.ResponseWriter, r *http.Request) {
	var in store.CompetitionInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if in.Currency == "" {
		in.Currency = "EUR"
	}
	if in.Status == "" {
		in.Status = "draft"
	}
	c, err := s.St.CreateCompetition(r.Context(), in)
	if err != nil {
		httpx.Fail(w, 400, "could not create competition: "+err.Error())
		return
	}
	s.audit(r, "competition.create", c.Slug, nil)
	httpx.JSON(w, 201, c)
}

func (s *Server) adminUpdateCompetition(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in store.CompetitionInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	c, err := s.St.UpdateCompetition(r.Context(), id, in)
	if err != nil {
		httpx.Fail(w, 400, "could not update competition")
		return
	}
	s.audit(r, "competition.update", c.Slug, nil)
	httpx.JSON(w, 200, c)
}

func (s *Server) adminSetStatus(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in struct {
		Status string `json:"status"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if err := s.St.SetCompetitionStatus(r.Context(), id, in.Status); err != nil {
		httpx.Fail(w, 400, "could not change status")
		return
	}
	s.audit(r, "competition.status", id.String(), map[string]any{"status": in.Status})
	httpx.JSON(w, 200, map[string]string{"status": in.Status})
}

func (s *Server) adminDeleteCompetition(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	if err := s.St.DeleteCompetition(r.Context(), id); err != nil {
		httpx.Fail(w, 409, "competition has entries and cannot be deleted")
		return
	}
	s.audit(r, "competition.delete", id.String(), nil)
	httpx.JSON(w, 204, nil)
}

// ---------- صفحات و تنظیمات ----------

func (s *Server) adminListPages(w http.ResponseWriter, r *http.Request) {
	ps, err := s.St.ListPages(r.Context(), false)
	if err != nil {
		httpx.Fail(w, 500, "could not load pages")
		return
	}
	httpx.JSON(w, 200, map[string]any{"pages": ps})
}

func (s *Server) adminUpsertPage(w http.ResponseWriter, r *http.Request) {
	var in store.PageInput
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if in.Slug == "" {
		httpx.Fail(w, 400, "slug is required")
		return
	}
	p, err := s.St.UpsertPage(r.Context(), in)
	if err != nil {
		httpx.Fail(w, 400, "could not save page")
		return
	}
	s.audit(r, "page.save", p.Slug, nil)
	httpx.JSON(w, 200, p)
}

func (s *Server) adminDeletePage(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	_ = s.St.DeletePage(r.Context(), slug)
	s.audit(r, "page.delete", slug, nil)
	httpx.JSON(w, 204, nil)
}

// settingsAllowed کلیدهایی است که پنل مدیریت اجازهٔ نوشتنشان را دارد.
// هر چیز دیگری رد می‌شود تا یک ادمین نتواند فضای تنظیمات را با کلیدهای
// دلخواه پر کند یا کلیدهای داخلی را بازنویسی کند.
var settingsAllowed = map[string]bool{
	// کلیدهای ساختاری که seeder می‌نویسد
	"brand": true, "theme": true, "nav": true, "banner": true,
	// کلیدهای تختی که فرم پنل می‌فرستد
	"site_name": true, "tagline": true, "support_email": true,
	"free_entry_address": true, "color_brand": true, "color_ink": true,
	"color_canvas": true, "hero_image": true, "near_miss_threshold": true,
	"near_miss_max_percent": true, "packs": true, "min_age": true,
	"maintenance": true,
}

func (s *Server) adminSetSettings(w http.ResponseWriter, r *http.Request) {
	var in map[string]any
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	// ابتدا همهٔ کلیدها اعتبارسنجی می‌شوند و بعد نوشتن آغاز می‌شود؛ پیمایش
	// map در Go ترتیب تصادفی دارد و اعتبارسنجی درون حلقهٔ نوشتن، با یک کلید
	// نامعتبر بخشی از تغییرات را ماندگار می‌کرد.
	for k := range in {
		if !settingsAllowed[k] {
			httpx.Fail(w, 400, "unknown setting: "+k)
			return
		}
	}
	for k, v := range in {
		if err := s.St.SetSetting(r.Context(), k, v); err != nil {
			httpx.Fail(w, 500, "could not save setting "+k)
			return
		}
	}
	s.audit(r, "settings.update", "", map[string]any{"keys": len(in)})
	set, _ := s.St.Settings(r.Context())
	httpx.JSON(w, 200, set)
}

// ---------- کاربران ----------

func (s *Server) adminListUsers(w http.ResponseWriter, r *http.Request) {
	users, total, err := s.St.ListUsers(r.Context(), store.UserFilter{
		Search: r.URL.Query().Get("q"),
		Role:   r.URL.Query().Get("role"),
		Limit:  qInt(r, "limit", 50),
		Offset: qInt(r, "offset", 0),
	})
	if err != nil {
		httpx.Fail(w, 500, "could not load users")
		return
	}
	httpx.JSON(w, 200, map[string]any{"users": users, "total": total})
}

func (s *Server) adminUpdateUser(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in store.UserPatch
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	// هر تغییر نقش فقط از superadmin پذیرفته می‌شود — چه ارتقا و چه تنزل.
	// اگر فقط تنزل را آزاد بگذاریم، یک ادمین پشتیبانی می‌تواند مدیر کل را
	// به کاربر عادی تبدیل کند و کنترل سامانه را از او بگیرد.
	// نبودن کلید role در بدنه یعنی نقش اصلاً تغییر نمی‌کند.
	actor, _ := auth.From(r.Context())
	if in.Role != nil && actor.Role != auth.RoleSuperAdmin {
		httpx.Fail(w, 403, "only a superadmin can change roles")
		return
	}
	// مدیر کل هم نباید نقش خودش را پایین بیاورد و آخرین دسترسی را قفل کند.
	if in.Role != nil && *in.Role != auth.RoleSuperAdmin && actor.ID == id {
		httpx.Fail(w, 400, "you cannot demote your own account")
		return
	}
	u, err := s.St.UpdateUserAdmin(r.Context(), id, in)
	if err != nil {
		httpx.Fail(w, 400, "could not update user")
		return
	}
	s.audit(r, "user.update", u.Email, map[string]any{
		"role": u.Role, "blocked": u.IsBlocked, "insider": u.IsInsider})
	httpx.JSON(w, 200, u)
}

func (s *Server) adminAddCredit(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in struct {
		Cents  int64  `json:"cents"`
		Reason string `json:"reason"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if err := s.St.AddCredit(r.Context(), id, in.Cents); err != nil {
		httpx.Fail(w, 400, "could not adjust credit")
		return
	}
	s.audit(r, "user.credit", id.String(), map[string]any{"cents": in.Cents, "reason": in.Reason})
	httpx.JSON(w, 200, map[string]any{"status": "ok"})
}

// ---------- سفارش‌ها ----------

func (s *Server) adminListOrders(w http.ResponseWriter, r *http.Request) {
	orders, total, err := s.St.ListOrders(r.Context(), store.OrderFilter{
		Status: r.URL.Query().Get("status"),
		Search: r.URL.Query().Get("q"),
		Limit:  qInt(r, "limit", 50),
		Offset: qInt(r, "offset", 0),
	})
	if err != nil {
		httpx.Fail(w, 500, "could not load orders")
		return
	}
	httpx.JSON(w, 200, map[string]any{"orders": orders, "total": total})
}

func (s *Server) adminRefund(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	if err := s.St.RefundOrder(r.Context(), id); err != nil {
		httpx.Fail(w, 400, "could not refund order")
		return
	}
	s.audit(r, "order.refund", id.String(), nil)
	httpx.JSON(w, 200, map[string]string{"status": "refunded"})
}

// ---------- داوری و تسویه ----------

func (s *Server) adminPanel(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	panel, err := s.St.JudgePanel(r.Context(), id)
	if err != nil {
		httpx.Fail(w, 500, "could not load judge panel")
		return
	}
	httpx.JSON(w, 200, map[string]any{"panel": panel})
}

func (s *Server) adminEntries(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	es, err := s.St.ListEntries(r.Context(), id, qInt(r, "limit", 200))
	if err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "entries.view", id.String(), map[string]any{"count": len(es)})
	httpx.JSON(w, 200, map[string]any{"entries": es})
}

func (s *Server) adminVerifyChain(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	checked, badSeq, err := s.St.VerifyEntryChain(r.Context(), id)
	if err != nil {
		httpx.Fail(w, 500, "verification failed")
		return
	}
	httpx.JSON(w, 200, map[string]any{
		"checked": checked, "intact": badSeq == 0, "first_bad_seq": badSeq,
	})
}

func (s *Server) adminSettle(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	res, err := s.St.Settle(r.Context(), id)
	if err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "competition.settle", id.String(), map[string]any{
		"final_x": res.FinalX, "final_y": res.FinalY})
	httpx.JSON(w, 200, res)
}

func (s *Server) adminSetVideo(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in struct {
		URL string `json:"url"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if err := s.St.SetResultVideo(r.Context(), id, in.URL); err != nil {
		httpx.Fail(w, 400, "could not save video url")
		return
	}
	s.audit(r, "result.video", id.String(), nil)
	httpx.JSON(w, 200, map[string]string{"status": "ok"})
}

// ---------- داور ----------

func (s *Server) judgeCompetitions(w http.ResponseWriter, r *http.Request) {
	comps, err := s.St.ListCompetitions(r.Context(),
		[]string{"open", "closed", "judging"}, true)
	if err != nil {
		httpx.Fail(w, 500, "could not load competitions")
		return
	}
	httpx.JSON(w, 200, map[string]any{"competitions": comps})
}

func (s *Server) judgeCommit(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	p, _ := auth.From(r.Context())
	var in struct {
		CommitHash string `json:"commit_hash"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if len(in.CommitHash) != 64 {
		httpx.Fail(w, 400, "commit_hash must be a 64-character sha256 hex digest")
		return
	}
	if err := s.St.Commit(r.Context(), id, p.ID, in.CommitHash); err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "judge.commit", id.String(), nil)
	httpx.JSON(w, 201, map[string]string{"status": "committed"})
}

func (s *Server) judgeReveal(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	p, _ := auth.From(r.Context())
	var in struct {
		X     float64 `json:"x"`
		Y     float64 `json:"y"`
		Nonce string  `json:"nonce"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if err := s.St.Reveal(r.Context(), id, p.ID, in.X, in.Y, in.Nonce); err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "judge.reveal", id.String(), map[string]any{"x": in.X, "y": in.Y})
	httpx.JSON(w, 200, map[string]string{"status": "revealed"})
}

func (s *Server) audit(r *http.Request, action, target string, meta map[string]any) {
	p, ok := auth.From(r.Context())
	var actor *uuid.UUID
	if ok {
		actor = &p.ID
	}
	s.St.Audit(r.Context(), actor, action, target, meta, httpx.ClientIP(r))
}
