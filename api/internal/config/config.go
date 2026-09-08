package config

import (
	"log"
	"os"
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
}

func Load() Config {
	c := Config{
		Port:          env("PORT", "8080"),
		DatabaseURL:   env("DATABASE_URL", "postgres://dreamdrive:dreamdrive@localhost:5432/dreamdrive?sslmode=disable"),
		JWTSecret:     env("JWT_SECRET", devSecret),
		CORSOrigin:    env("CORS_ORIGIN", "http://localhost:3000"),
		Env:           env("APP_ENV", "development"),
		WebhookSecret: env("PAYMENT_WEBHOOK_SECRET", ""),
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
	return c
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
