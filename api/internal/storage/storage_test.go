package storage

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestDetectType(t *testing.T) {
	png := []byte("\x89PNG\r\n\x1a\n" + strings.Repeat("\x00", 40))
	gif := []byte("GIF89a" + strings.Repeat("\x00", 40))
	avif := append([]byte{0, 0, 0, 32}, []byte("ftypavif"+strings.Repeat("\x00", 40))...)

	cases := []struct {
		name string
		body []byte
		mime string
		ext  string
	}{
		{"png", png, "image/png", ".png"},
		{"gif", gif, "image/gif", ".gif"},
		// AVIF را DetectContentType نمی‌شناسد؛ این مورد مسیر دستی را می‌سنجد.
		{"avif", avif, "image/avif", ".avif"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			mime, ext, err := DetectType(c.body)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if mime != c.mime || ext != c.ext {
				t.Fatalf("got %q %q, want %q %q", mime, ext, c.mime, c.ext)
			}
		})
	}
}

// SVG می‌تواند جاوااسکریپت اجرا کند و از دامنهٔ خودمان سرو می‌شود، پس
// پذیرفته شدنش یک آسیب‌پذیری واقعی است نه صرفاً یک ناسازگاری.
func TestDetectTypeRejectsScriptable(t *testing.T) {
	for _, body := range [][]byte{
		[]byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`),
		[]byte("<!DOCTYPE html><html><body>hi</body></html>"),
		[]byte("PK\x03\x04" + strings.Repeat("\x00", 40)),
	} {
		if _, _, err := DetectType(body); !errors.Is(err, ErrUnsupportedType) {
			t.Fatalf("body %q was accepted", body[:min(16, len(body))])
		}
	}
}

func TestNewKeyIsUniqueAndScoped(t *testing.T) {
	seen := map[string]bool{}
	for i := 0; i < 200; i++ {
		k := NewKey("prizes", ".png")
		if !strings.HasPrefix(k, "prizes/") || !strings.HasSuffix(k, ".png") {
			t.Fatalf("unexpected key shape: %q", k)
		}
		if seen[k] {
			t.Fatalf("duplicate key: %q", k)
		}
		seen[k] = true
	}
}

func TestLocalPutRejectsTraversal(t *testing.T) {
	dir := t.TempDir()
	l, err := NewLocal(dir, "http://localhost:8080")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := l.Put(context.Background(), "../escape.png", []byte("x"), "image/png"); err == nil {
		t.Fatal("traversal key was accepted")
	}
	if _, err := os.Stat(filepath.Join(filepath.Dir(dir), "escape.png")); err == nil {
		t.Fatal("a file was written outside the upload directory")
	}
}

func TestLocalHandlerHidesListings(t *testing.T) {
	dir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(dir, "prizes"), 0o755); err != nil {
		t.Fatal(err)
	}
	l, err := NewLocal(dir, "http://localhost:8080")
	if err != nil {
		t.Fatal(err)
	}
	prefix, h := l.Handler()
	mux := http.NewServeMux()
	mux.Handle(prefix, h)

	// هم ریشه و هم زیرپوشه باید ۴۰۴ بدهند، نه فهرست فایل‌ها.
	for _, p := range []string{"/uploads/", "/uploads/prizes/"} {
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, httptest.NewRequest("GET", p, nil))
		if rec.Code != http.StatusNotFound {
			t.Fatalf("%s returned %d, want 404 (body: %q)", p, rec.Code, rec.Body.String())
		}
	}
}

func TestReadLimited(t *testing.T) {
	if _, err := ReadLimited(strings.NewReader(strings.Repeat("a", 11)), 10); err == nil {
		t.Fatal("oversized body was accepted")
	}
	b, err := ReadLimited(strings.NewReader(strings.Repeat("a", 10)), 10)
	if err != nil || len(b) != 10 {
		t.Fatalf("exact-limit body rejected: %v", err)
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
