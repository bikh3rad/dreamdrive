package api

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/httpx"
)

// مسیرهای ناظر مستقل.
//
// اصل طراحی: ناظر فقط می‌خواند. تنها عمل نوشتنی‌اش رسیدگی به حادثه است —
// نه تغییر مسابقه، نه دیدن مختصات پیشنهادها پیش از بسته‌شدن، نه دست بردن
// در نتیجه. هرچه دامنهٔ اختیارش کمتر باشد، شهادتش معتبرتر است.

func (s *Server) auditorIncidents(w http.ResponseWriter, r *http.Request) {
	onlyOpen := r.URL.Query().Get("open") == "1"
	ins, err := s.St.ListIncidents(r.Context(), onlyOpen, qInt(r, "limit", 100))
	if err != nil {
		httpx.Fail(w, 500, "could not load incidents")
		return
	}
	httpx.JSON(w, 200, map[string]any{"incidents": ins})
}

// auditorVerify بررسی مستقل زنجیره. ناظر نباید برای دانستن سالم‌بودن زنجیره
// به حرف ادمین تکیه کند، پس همان محاسبه را خودش اجرا می‌کند.
func (s *Server) auditorVerify(w http.ResponseWriter, r *http.Request) {
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
	var incidentID int64
	if badSeq != 0 {
		incidentID, err = s.St.RecordIncident(r.Context(), id, "chain_broken",
			"بررسی زنجیره توسط ناظر مستقل اجرا شد و رکورد معیوب یافت شد.",
			badSeq, checked)
		if err != nil {
			httpx.Fail(w, 500, "could not record the integrity incident")
			return
		}
	}
	s.audit(r, "auditor.verify", id.String(), map[string]any{
		"intact": badSeq == 0, "first_bad_seq": badSeq})
	httpx.JSON(w, 200, map[string]any{
		"checked": checked, "intact": badSeq == 0, "first_bad_seq": badSeq,
		"incident_id": incidentID,
	})
}

// auditorPanel وضعیت تعهد و افشای داوران. مختصات فقط پس از افشا برگردانده
// می‌شود — همان محدودیتی که برای ادمین هم اعمال است.
func (s *Server) auditorPanel(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	panel, err := s.St.JudgePanel(r.Context(), id)
	if err != nil {
		httpx.Fail(w, 500, "could not load the judging panel")
		return
	}
	httpx.JSON(w, 200, map[string]any{"panel": panel})
}

// auditorCompetitions فهرست مسابقه‌ها برای انتخاب در صفحهٔ ناظر.
func (s *Server) auditorCompetitions(w http.ResponseWriter, r *http.Request) {
	comps, err := s.St.ListCompetitions(r.Context(),
		[]string{"draft", "open", "closed", "judging", "settled", "cancelled"}, true)
	if err != nil {
		httpx.Fail(w, 500, "could not load competitions")
		return
	}
	httpx.JSON(w, 200, map[string]any{"competitions": comps})
}

// auditorAudit لاگ کامل عملیات مدیریتی. ناظر باید بتواند ببیند چه کسی چه
// کاری کرده است، وگرنه نظارتش به گزارشِ خودِ متهم محدود می‌شود.
func (s *Server) auditorAudit(w http.ResponseWriter, r *http.Request) {
	es, err := s.St.ListAudit(r.Context(), qInt(r, "limit", 100), qInt(r, "offset", 0))
	if err != nil {
		httpx.Fail(w, 500, "could not load the audit log")
		return
	}
	httpx.JSON(w, 200, map[string]any{"entries": es})
}

// auditorRaise ناظر خودش حادثه ثبت می‌کند و تسویه را متوقف می‌کند.
//
// بدون این مسیر، هر اختیارِ ناظر در جهت *باز کردن* قفل بود: تأیید و بستن.
// ناظری که به چیزی جز شکستن زنجیره مشکوک شود — مثلاً الگوی مشکوک در تعهد
// داوران یا خبری از بیرون — هیچ راهی برای متوقف کردن تسویه نداشت، و این
// دقیقاً برعکس نقشی است که صفحهٔ /audit به او وعده می‌دهد.
func (s *Server) auditorRaise(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid id")
		return
	}
	var in struct {
		Detail string `json:"detail"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	if len([]rune(strings.TrimSpace(in.Detail))) < 20 {
		httpx.Fail(w, 400, "describe the concern in at least 20 characters; this text becomes a permanent record")
		return
	}
	// بدون این بررسی، یک UUID ناموجود به خطای کلید خارجی و پاسخ ۵۰۰ می‌خورد
	// که پیامش «ثبت نشد» است — ناظر فکر می‌کند سامانه خراب است.
	if _, err := s.St.CompetitionByID(r.Context(), id); err != nil {
		httpx.Fail(w, 404, "competition not found")
		return
	}
	incID, err := s.St.RecordIncident(r.Context(), id, "manual",
		strings.TrimSpace(in.Detail), 0, 0)
	if err != nil {
		httpx.Fail(w, 500, "could not record the integrity incident")
		return
	}
	s.audit(r, "auditor.incident.raise", id.String(),
		map[string]any{"incident_id": incID})
	httpx.JSON(w, 201, map[string]any{"incident_id": incID, "status": "open"})
}

func incidentID(r *http.Request) (int64, bool) {
	n, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	return n, err == nil
}

func (s *Server) auditorAck(w http.ResponseWriter, r *http.Request) {
	id, ok := incidentID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid incident id")
		return
	}
	p, _ := auth.From(r.Context())
	if err := s.St.AcknowledgeIncident(r.Context(), id, p.ID); err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "auditor.incident.ack", strconv.FormatInt(id, 10), nil)
	httpx.JSON(w, 200, map[string]string{"status": "acknowledged"})
}

// auditorResolve بستن حادثه. این تنها راه باز شدن قفل تسویه است و توضیح
// مکتوب اجباری است تا در صورت بازبینی بیرونی، دلیلِ تصمیم ثبت شده باشد.
func (s *Server) auditorResolve(w http.ResponseWriter, r *http.Request) {
	id, ok := incidentID(r)
	if !ok {
		httpx.Fail(w, 400, "invalid incident id")
		return
	}
	var in struct {
		Resolution string `json:"resolution"`
	}
	if err := httpx.Decode(r, &in); err != nil {
		httpx.Fail(w, 400, "invalid request body")
		return
	}
	p, _ := auth.From(r.Context())
	if err := s.St.ResolveIncident(r.Context(), id, p.ID, in.Resolution); err != nil {
		httpx.Fail(w, 409, err.Error())
		return
	}
	s.audit(r, "auditor.incident.resolve", strconv.FormatInt(id, 10),
		map[string]any{"resolution": in.Resolution})
	httpx.JSON(w, 200, map[string]string{"status": "resolved"})
}
