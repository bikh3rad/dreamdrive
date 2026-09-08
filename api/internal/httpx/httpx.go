// Package httpx حاوی کمک‌توابع مشترک برای پاسخ‌های JSON و خطاها.
package httpx

import (
	"bytes"
	"encoding/json"
	"net/http"
)

type ErrBody struct {
	Error string `json:"error"`
}

func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if v != nil {
		_ = json.NewEncoder(w).Encode(v)
	}
}

func Fail(w http.ResponseWriter, status int, msg string) {
	JSON(w, status, ErrBody{Error: msg})
}

func Decode(r *http.Request, v any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 1<<20))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

// DecodeBytes همان قواعد Decode را روی بدنه‌ای اعمال می‌کند که پیش‌تر
// خوانده شده است — مثلاً وقتی باید امضای HMAC روی بایت خام بررسی شود.
func DecodeBytes(body []byte, v any) error {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

// DecodeBytesLoose فیلدهای ناشناخته را نادیده می‌گیرد. فقط برای بدنه‌هایی
// که فرستنده‌شان پیش‌تر با امضا احراز شده است: درگاه‌های پرداخت واقعی
// ده‌ها فیلد اضافه می‌فرستند و سخت‌گیری روی فیلدها آن‌ها را رد می‌کند.
func DecodeBytesLoose(body []byte, v any) error {
	return json.Unmarshal(body, v)
}

// ClientIP آدرس واقعی کاربر را با توجه به پروکسی برمی‌گرداند.
func ClientIP(r *http.Request) string {
	if v := r.Header.Get("X-Forwarded-For"); v != "" {
		for i := 0; i < len(v); i++ {
			if v[i] == ',' {
				return v[:i]
			}
		}
		return v
	}
	return r.RemoteAddr
}
