package api

import (
	"errors"
	"net/http"
	"strings"

	"dreamdrive/api/internal/httpx"
	"dreamdrive/api/internal/storage"
)

// allowedFolders پوشه‌هایی که ادمین اجازهٔ نوشتن در آن‌ها را دارد.
// بدون این فهرست، هر رشته‌ای که کلاینت بفرستد به مسیر فایل تبدیل می‌شد.
var allowedFolders = map[string]bool{
	"prizes": true, // تصویر شاخص و گالری جوایز
	"boards": true, // تصویر تختهٔ بازی
	"pages":  true, // تصاویر داخل صفحات محتوایی
	"brand":  true, // لوگو و تصاویر ظاهر سایت
}

// uploadImage یک تصویر می‌گیرد و نشانی عمومی‌اش را برمی‌گرداند.
//
// فرم multipart با فیلد «file» و پارامتر اختیاری «folder».
// فقط نقش‌های محتوایی به این مسیر دسترسی دارند (در روتر اعمال شده).
func (s *Server) uploadImage(w http.ResponseWriter, r *http.Request) {
	if s.Files == nil {
		httpx.Fail(w, 503, "file storage is not configured")
		return
	}

	// سقف را روی خود بدنه هم می‌گذاریم تا یک فایل غول‌پیکر حافظه را پر نکند.
	r.Body = http.MaxBytesReader(w, r.Body, storage.MaxUploadBytes+(1<<20))
	if err := r.ParseMultipartForm(4 << 20); err != nil {
		httpx.Fail(w, 400, "could not read the upload; is it a multipart form?")
		return
	}
	defer func() {
		if r.MultipartForm != nil {
			_ = r.MultipartForm.RemoveAll()
		}
	}()

	file, _, err := r.FormFile("file")
	if err != nil {
		httpx.Fail(w, 400, "no file was sent in the 'file' field")
		return
	}
	defer file.Close()

	body, err := storage.ReadLimited(file, storage.MaxUploadBytes)
	if err != nil {
		httpx.Fail(w, 413, err.Error())
		return
	}
	if len(body) == 0 {
		httpx.Fail(w, 400, "the uploaded file is empty")
		return
	}

	// نوع فایل از روی محتوا تشخیص داده می‌شود، نه از پسوند یا هدری که
	// کلاینت فرستاده — هر دو جعل‌شدنی‌اند.
	mime, ext, err := storage.DetectType(body)
	if err != nil {
		if errors.Is(err, storage.ErrUnsupportedType) {
			httpx.Fail(w, 415, err.Error())
			return
		}
		httpx.Fail(w, 400, "could not read the image")
		return
	}

	folder := strings.TrimSpace(r.FormValue("folder"))
	if folder == "" {
		folder = "prizes"
	}
	if !allowedFolders[folder] {
		httpx.Fail(w, 400, "unknown folder: "+folder)
		return
	}

	key := storage.NewKey(folder, ext)
	url, err := s.Files.Put(r.Context(), key, body, mime)
	if err != nil {
		httpx.Fail(w, 502, "could not store the file: "+err.Error())
		return
	}

	s.audit(r, "media.upload", key, map[string]any{"bytes": len(body), "type": mime})
	httpx.JSON(w, 201, map[string]any{
		"url":   url,
		"key":   key,
		"bytes": len(body),
		"type":  mime,
	})
}
