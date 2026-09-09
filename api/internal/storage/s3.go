package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// S3 هر انبارهٔ سازگار با S3: MinIO، Cloudflare R2، Backblaze B2، آروان،
// لیارا یا خود AWS.
//
// امضای SigV4 دستی نوشته شده تا پروژه به SDK بزرگ AWS وابسته نشود؛ برای
// یک PUT ساده حدود صد خط کد است و وابستگی کمتر یعنی سطح حملهٔ کمتر.
type S3 struct {
	Endpoint  string // https://s3.example.com  یا  http://minio:9000
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
	// PublicBase نشانی پایه برای خواندن فایل‌ها. اگر CDN داری اینجا بگذار.
	// خالی یعنی از Endpoint/Bucket استفاده شود.
	PublicBase string
	// PathStyle برای MinIO و اغلب سرویس‌های ایرانی لازم است
	// (endpoint/bucket/key به‌جای bucket.endpoint/key).
	PathStyle bool

	HTTP *http.Client
}

func (s *S3) client() *http.Client {
	if s.HTTP != nil {
		return s.HTTP
	}
	return &http.Client{Timeout: 30 * time.Second}
}

func (s *S3) objectURL(key string) (host, fullURL string) {
	ep := strings.TrimRight(s.Endpoint, "/")
	u, err := url.Parse(ep)
	if err != nil {
		return "", ""
	}
	if s.PathStyle {
		return u.Host, ep + "/" + s.Bucket + "/" + key
	}
	return s.Bucket + "." + u.Host, u.Scheme + "://" + s.Bucket + "." + u.Host + "/" + key
}

func (s *S3) Put(ctx context.Context, key string, body []byte, contentType string) (string, error) {
	host, endpoint := s.objectURL(key)
	if endpoint == "" {
		return "", fmt.Errorf("invalid S3 endpoint: %q", s.Endpoint)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	payloadHash := sha256hex(body)
	now := time.Now().UTC()

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("X-Amz-Content-Sha256", payloadHash)
	req.Header.Set("X-Amz-Date", now.Format("20060102T150405Z"))
	req.Header.Set("Host", host)
	req.ContentLength = int64(len(body))

	s.sign(req, payloadHash, now)

	res, err := s.client().Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		msg, _ := io.ReadAll(io.LimitReader(res.Body, 2048))
		return "", fmt.Errorf("object storage rejected the upload (%d): %s",
			res.StatusCode, strings.TrimSpace(string(msg)))
	}

	if s.PublicBase != "" {
		return strings.TrimRight(s.PublicBase, "/") + "/" + key, nil
	}
	return endpoint, nil
}

// Handler برای S3 لازم نیست؛ فایل‌ها را خود انباره یا CDN سرو می‌کند.
func (s *S3) Handler() (string, http.Handler) { return "", nil }

// sign هدر Authorization را طبق AWS Signature Version 4 می‌سازد.
func (s *S3) sign(req *http.Request, payloadHash string, now time.Time) {
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")

	// هدرهای امضاشونده باید مرتب و با نام کوچک باشند.
	signed := []string{"content-type", "host", "x-amz-content-sha256", "x-amz-date"}
	var canonHeaders strings.Builder
	for _, h := range signed {
		v := req.Header.Get(h)
		if h == "host" {
			v = req.Host
			if v == "" {
				v = req.URL.Host
			}
		}
		canonHeaders.WriteString(h + ":" + strings.TrimSpace(v) + "\n")
	}
	signedHeaders := strings.Join(signed, ";")

	canonicalReq := strings.Join([]string{
		req.Method,
		escapePath(req.URL.Path),
		req.URL.RawQuery,
		canonHeaders.String(),
		signedHeaders,
		payloadHash,
	}, "\n")

	scope := strings.Join([]string{dateStamp, s.Region, "s3", "aws4_request"}, "/")
	stringToSign := strings.Join([]string{
		"AWS4-HMAC-SHA256",
		amzDate,
		scope,
		sha256hex([]byte(canonicalReq)),
	}, "\n")

	kDate := hmacSHA256([]byte("AWS4"+s.SecretKey), dateStamp)
	kRegion := hmacSHA256(kDate, s.Region)
	kService := hmacSHA256(kRegion, "s3")
	kSigning := hmacSHA256(kService, "aws4_request")
	signature := hex.EncodeToString(hmacSHA256(kSigning, stringToSign))

	req.Header.Set("Authorization", fmt.Sprintf(
		"AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		s.AccessKey, scope, signedHeaders, signature))
}

// escapePath هر بخش مسیر را جداگانه encode می‌کند؛ اسلش‌ها باید دست‌نخورده
// بمانند وگرنه امضا با آنچه سرور محاسبه می‌کند نمی‌خواند.
func escapePath(p string) string {
	parts := strings.Split(p, "/")
	for i, s := range parts {
		parts[i] = url.PathEscape(s)
	}
	return strings.Join(parts, "/")
}

func sha256hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, data string) []byte {
	m := hmac.New(sha256.New, key)
	m.Write([]byte(data))
	return m.Sum(nil)
}
