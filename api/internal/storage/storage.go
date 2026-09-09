// Package storage نگه‌داری فایل‌های آپلودی (تصویر جوایز و تختهٔ بازی).
//
// دو پیاده‌سازی دارد:
//
//   - Local: روی دیسک می‌نویسد و خود API آن را سرو می‌کند. برای توسعه و
//     استقرارهای تک‌سروری کافی است و هیچ سرویس بیرونی نمی‌خواهد.
//   - S3: هر انبارهٔ سازگار با S3 — MinIO، Cloudflare R2، Backblaze B2،
//     Liara، آروان یا خود AWS.
//
// انتخاب با متغیر محیطی STORAGE_DRIVER انجام می‌شود.
package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

// MaxUploadBytes سقف حجم هر فایل. تصویر وب بالاتر از این تقریباً همیشه
// یعنی کاربر عکس دوربین را بدون فشرده‌سازی فرستاده.
const MaxUploadBytes = 8 << 20 // 8 MiB

// allowedTypes فقط قالب‌های تصویری امن برای نمایش در مرورگر.
// SVG عمداً نیست: می‌تواند جاوااسکریپت اجرا کند و از همان دامنه سرو می‌شود.
var allowedTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/avif": ".avif",
	"image/gif":  ".gif",
}

var ErrUnsupportedType = errors.New("only jpeg, png, webp, avif and gif images are accepted")

// isAVIF جعبهٔ ftyp را در بایت‌های ۵ تا ۱۲ بررسی می‌کند. avis نسخهٔ
// دنباله‌ای (انیمیشن) همان قالب است.
func isAVIF(b []byte) bool {
	if len(b) < 12 || string(b[4:8]) != "ftyp" {
		return false
	}
	brand := string(b[8:12])
	return brand == "avif" || brand == "avis"
}

// Store یک انباره است. Put فایل را ذخیره می‌کند و نشانی عمومی برمی‌گرداند.
type Store interface {
	Put(ctx context.Context, key string, body []byte, contentType string) (string, error)
	// Handler اگر انباره خودش باید فایل‌ها را سرو کند غیر nil است.
	Handler() (prefix string, h http.Handler)
}

// DetectType نوع فایل را از محتوای واقعی‌اش تشخیص می‌دهد، نه از پسوند یا
// هدر Content-Type که هر دو را کلاینت تعیین می‌کند و جعل‌شدنی‌اند.
func DetectType(body []byte) (mime, ext string, err error) {
	// http.DetectContentType امضای AVIF را نمی‌شناسد و آن را
	// application/octet-stream می‌بیند، پس خودمان جعبهٔ ftyp را می‌خوانیم.
	if isAVIF(body) {
		return "image/avif", ".avif", nil
	}
	mime = http.DetectContentType(body)
	// DetectContentType گاهی پارامتر اضافه می‌چسباند («; charset=…»)
	if i := strings.IndexByte(mime, ';'); i >= 0 {
		mime = strings.TrimSpace(mime[:i])
	}
	ext, ok := allowedTypes[mime]
	if !ok {
		return "", "", ErrUnsupportedType
	}
	return mime, ext, nil
}

// NewKey یک نام یکتا و بی‌خطر می‌سازد. نام اصلی فایل که کاربر فرستاده دور
// ریخته می‌شود؛ نگه‌داشتنش راه ورود «../» و نام‌های عجیب به سیستم فایل است.
func NewKey(folder, ext string) string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	return fmt.Sprintf("%s/%s-%s%s",
		strings.Trim(folder, "/"),
		time.Now().UTC().Format("20060102"),
		hex.EncodeToString(b[:]),
		ext)
}

// ---------- انبارهٔ محلی ----------

type Local struct {
	Dir     string // پوشهٔ روی دیسک
	BaseURL string // نشانی عمومی API، مثلاً http://localhost:8080
}

func NewLocal(dir, baseURL string) (*Local, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Local{Dir: dir, BaseURL: strings.TrimRight(baseURL, "/")}, nil
}

func (l *Local) Put(_ context.Context, key string, body []byte, _ string) (string, error) {
	// key را خودمان ساخته‌ایم، ولی باز هم پاک‌سازی می‌کنیم تا اگر روزی از
	// ورودی کاربر آمد، نوشتن بیرون از Dir ممکن نباشد.
	clean := filepath.Join(l.Dir, filepath.FromSlash(path.Clean("/"+key)))
	if !strings.HasPrefix(clean, filepath.Clean(l.Dir)+string(os.PathSeparator)) {
		return "", errors.New("invalid object key")
	}
	if err := os.MkdirAll(filepath.Dir(clean), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(clean, body, 0o644); err != nil {
		return "", err
	}
	return l.BaseURL + "/uploads/" + strings.TrimPrefix(key, "/"), nil
}

func (l *Local) Handler() (string, http.Handler) {
	fs := http.FileServer(http.Dir(l.Dir))
	return "/uploads/", http.StripPrefix("/uploads/", noDirList(fs))
}

// noDirList فهرست شدن محتوای پوشه‌ها را می‌بندد.
func noDirList(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// حالت خالی هم باید بسته شود: StripPrefix مسیر «/uploads/» را به
		// رشتهٔ تهی تبدیل می‌کند و FileServer آن را ریشه می‌بیند.
		if r.URL.Path == "" || strings.HasSuffix(r.URL.Path, "/") {
			http.NotFound(w, r)
			return
		}
		// فایل‌ها تغییرناپذیرند (نام یکتا دارند) پس کش طولانی امن است.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		// جلوی حدس زدن نوع فایل توسط مرورگر را می‌گیرد؛ چون این فایل‌ها از
		// دامنهٔ خود API سرو می‌شوند، حدس اشتباه می‌تواند به اجرای کد برسد.
		w.Header().Set("X-Content-Type-Options", "nosniff")
		next.ServeHTTP(w, r)
	})
}

// ReadLimited بدنه را با سقف حجم می‌خواند و در صورت عبور از سقف خطا می‌دهد.
func ReadLimited(r io.Reader, max int64) ([]byte, error) {
	// یک بایت بیشتر می‌خوانیم تا بتوانیم «دقیقاً به سقف رسید» را از
	// «از سقف رد شد» تشخیص دهیم.
	b, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > max {
		return nil, fmt.Errorf("file is larger than %d MiB", max>>20)
	}
	return b, nil
}
