// Command server نقطهٔ ورود API.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"dreamdrive/api/internal/api"
	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/config"
	"dreamdrive/api/internal/storage"
	"dreamdrive/api/internal/store"
)

// buildStorage انبارهٔ فایل را طبق پیکربندی می‌سازد.
func buildStorage(cfg config.Config) (storage.Store, error) {
	if cfg.StorageDriver == "s3" {
		log.Printf("storage: s3 bucket %q at %s", cfg.S3Bucket, cfg.S3Endpoint)
		return &storage.S3{
			Endpoint:   cfg.S3Endpoint,
			Region:     cfg.S3Region,
			Bucket:     cfg.S3Bucket,
			AccessKey:  cfg.S3AccessKey,
			SecretKey:  cfg.S3SecretKey,
			PublicBase: cfg.S3PublicBase,
			PathStyle:  cfg.S3PathStyle,
		}, nil
	}
	// حالت پیش‌فرض: دیسک محلی. برای چند نمونهٔ همزمانِ API مناسب نیست،
	// چون هر نمونه فقط فایل‌های خودش را دارد؛ در آن حالت به s3 سوییچ کن.
	log.Printf("storage: local directory %s served at /uploads/", cfg.UploadDir)
	return storage.NewLocal(cfg.UploadDir, cfg.PublicURL)
}

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer st.Close()

	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("migrations applied")

	files, err := buildStorage(cfg)
	if err != nil {
		log.Fatalf("storage: %v", err)
	}

	srv := api.New(st, auth.NewManager(cfg.JWTSecret), cfg.WebhookSecret, files)
	if cfg.WebhookSecret == "" {
		log.Println("warning: PAYMENT_WEBHOOK_SECRET is unset — the payment webhook is disabled")
	}

	httpSrv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Router(cfg.CORSOrigin),
		ReadHeaderTimeout: 10 * time.Second,
	}

	// بستن خودکار مسابقه‌ها بر اساس دو شرط موازی: پایان مهلت، یا رسیدن به
	// سقف تعداد حدس. هر کدام زودتر رخ دهد دوره را آمادهٔ داوری می‌کند.
	stop := make(chan struct{})
	go func() {
		t := time.NewTicker(time.Minute)
		defer t.Stop()
		for {
			select {
			case <-t.C:
				n, err := st.CloseExpired(context.Background())
				if err != nil {
					log.Printf("close expired: %v", err)
				} else if n > 0 {
					log.Printf("closed %d expired competition(s)", n)
				}
				// جدا از بالا اجرا می‌شود: اگر یکی خطا داد، دیگری نباید
				// تا تیکِ بعدی معطل بماند.
				n, err = st.CloseAtTarget(context.Background())
				if err != nil {
					log.Printf("close at target: %v", err)
				} else if n > 0 {
					log.Printf("closed %d competition(s) that reached their entry target", n)
				}
			case <-stop:
				return
			}
		}
	}()

	go func() {
		log.Printf("api listening on :%s", cfg.Port)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("listen: %v", err)
		}
	}()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
	<-sig
	close(stop)

	shutCtx, shutCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutCancel()
	if err := httpSrv.Shutdown(shutCtx); err != nil {
		log.Printf("shutdown: %v", err)
	}
	log.Println("stopped")
}
