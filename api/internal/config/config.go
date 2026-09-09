package config

import (
	"log"
	"os"
	"strconv"
	"strings"
)

const devSecret = "dev-secret-change-me"

type Config struct {
	Port        string
	DatabaseURL string
	JWTSecret   string
	CORSOrigin  string
	Env         string
	// کلید مشترک با درگاه پرداخت؛ اگر خالی باشد وب‌هوک غیرفعال است.
	WebhookSecret string

	// --- انبارهٔ فایل ---
	// StorageDriver: "local" (پیش‌فرض) یا "s3".
	StorageDriver string
	// نشانی عمومی خود API؛ برای ساختن لینک فایل‌ها در حالت local لازم است.
	PublicURL string
	UploadDir string

	S3Endpoint   string
	S3Region     string
	S3Bucket     string
	S3AccessKey  string
	S3SecretKey  string
	S3PublicBase string
	S3PathStyle  bool
}

func Load() Config {
	c := Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://dreamdrive:dreamdrive@localhost:5432/dreamdrive?sslmode=disable"),
		JWTSecret:     env("JWT_SECRET", devSecret),
		CORSOrigin:    env("CORS_ORIGIN", "http://localhost:3000"),
		Env:           env("APP_ENV", "development"),
		WebhookSecret: env("PAYMENT_WEBHOOK_SECRET", ""),

		StorageDriver: env("STORAGE_DRIVER", "local"),
		PublicURL:     env("PUBLIC_URL", "http://localhost:8080"),
		UploadDir:     env("UPLOAD_DIR", "./data/uploads"),

		S3Endpoint:   env("S3_ENDPOINT", ""),
		S3Region:     env("S3_REGION", "us-east-1"),
		S3Bucket:     env("S3_BUCKET", ""),
		S3AccessKey:  env("S3_ACCESS_KEY", ""),
		S3SecretKey:  env("S3_SECRET_KEY", ""),
		S3PublicBase: env("S3_PUBLIC_BASE", ""),
		S3PathStyle:  envBool("S3_PATH_STYLE", true),
	}
	// کلید امضای پیش‌فرض نباید هرگز به محیط عملیاتی برسد؛ همهٔ توکن‌های
	// صادرشده با آن قابل جعل خواهند بود.
	if c.Env == "production" {
		if c.JWTSecret == devSecret {
			log.Fatal("JWT_SECRET must be set to a strong random value when APP_ENV=production")
		}
		if len(c.JWTSecret) < 32 {
			log.Fatal("JWT_SECRET must be at least 32 characters in production")
		}
		if c.WebhookSecret == "" {
			log.Fatal("PAYMENT_WEBHOOK_SECRET must be set in production; without it no order can be marked paid")
		}
	}
	if c.StorageDriver == "s3" {
		// نبود هر کدام از این‌ها یعنی آپلود در زمان اجرا خطا می‌دهد؛ بهتر
		// است همان لحظهٔ بالا آمدن بفهمیم تا وسط کار پنل.
		for k, v := range map[string]string{
			"S3_ENDPOINT":   c.S3Endpoint,
			"S3_BUCKET":     c.S3Bucket,
			"S3_ACCESS_KEY": c.S3AccessKey,
			"S3_SECRET_KEY": c.S3SecretKey,
		} {
			if v == "" {
				log.Fatalf("%s must be set when STORAGE_DRIVER=s3", k)
			}
		}
	}
	return c
}

// envBool مقادیر رایج بولی را می‌پذیرد (1، true، TRUE، yes…). مقدار
// نامفهوم به پیش‌فرض برمی‌گردد تا یک غلط تایپی بی‌صدا رفتار را عوض نکند.
func envBool(k string, def bool) bool {
	v := strings.TrimSpace(os.Getenv(k))
	if v == "" {
		return def
	}
	switch strings.ToLower(v) {
	case "yes", "on":
		return true
	case "no", "off":
		return false
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		log.Printf("warning: %s=%q is not a boolean; using %v", k, v, def)
		return def
	}
	return b
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
