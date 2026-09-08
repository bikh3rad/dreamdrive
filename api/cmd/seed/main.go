// Command seed دادهٔ نمونه برای توسعه می‌سازد.
package main

import (
	"context"
	"log"
	"time"

	"github.com/google/uuid"

	"dreamdrive/api/internal/auth"
	"dreamdrive/api/internal/config"
	"dreamdrive/api/internal/store"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	st, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("database: %v", err)
	}
	defer st.Close()
	if err := st.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}

	// ---------- کاربران ----------
	people := []struct {
		email, name, country, role string
	}{
		{"admin@besooyeroya.com", "سعید — مدیر کل", "IR", auth.RoleSuperAdmin},
		{"content@besooyeroya.com", "مریم — مدیر محتوا", "IR", auth.RoleContentAdmin},
		{"finance@besooyeroya.com", "کاوه — مدیر مالی", "IR", auth.RoleFinanceAdmin},
		{"support@besooyeroya.com", "نگار — پشتیبانی", "IR", auth.RoleSupport},
		{"judge1@panel.example", "Referee A. Moretti", "IT", auth.RoleJudge},
		{"judge2@panel.example", "Referee L. Bergström", "SE", auth.RoleJudge},
		{"judge3@panel.example", "Referee D. Okafor", "IE", auth.RoleJudge},
		{"james@example.com", "James W.", "CA", auth.RoleUser},
		{"priya@example.com", "Priya S.", "CA", auth.RoleUser},
		{"marc@example.com", "Marc L.", "CA", auth.RoleUser},
		{"sara@example.com", "Sara K.", "DE", auth.RoleUser},
		{"tom@example.com", "Tom R.", "GB", auth.RoleUser},
	}

	users := map[string]store.User{}
	hash, _ := auth.HashPassword("password123")
	for _, p := range people {
		u, err := st.CreateUser(ctx, p.email, hash, p.name, p.country, p.role)
		if err != nil {
			// اگر از قبل هست، همان را بردار
			u, err = st.UserByEmail(ctx, p.email)
			if err != nil {
				log.Fatalf("user %s: %v", p.email, err)
			}
		}
		users[p.email] = u
	}
	log.Printf("seeded %d users (password for all: password123)", len(users))

	// ---------- جوایز ----------
	type prizeSeed struct {
		in    store.PrizeInput
		media []string
	}
	prizes := []prizeSeed{
		{
			in: store.PrizeInput{
				Slug: "kish-island-dream-week", Title: "هفته رویایی جزیره کیش", Kind: "bundle",
				Subtitle: "ویلای ساحلی خصوصی + خودروی لوکس، هفت شب",
				BodyMD: "یک هفته فرار رویایی به جزیره کیش را ببر — یک ویلای خصوصی کنار دریای " +
					"فیروزه‌ای، یک خودروی لوکس متناسب و هفته‌ای از شکوه جزیره.\n\n" +
					"همه‌چیز شامل است: پرواز، ترانسفر، سرایدار و بیمهٔ خودرو.",
				Spec: map[string]any{
					"location": "جزیره کیش، ایران", "nights": 7, "guests": 4,
					"car": "Porsche 911 Carrera", "includes": []string{"پرواز", "ترانسفر", "سرایدار", "بیمه"},
				},
				ValueCents: 4500000,
				HeroImage:  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80",
			},
			media: []string{
				"https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80",
				"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1600&q=80",
				"https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1600&q=80",
			},
		},
		{
			in: store.PrizeInput{
				Slug: "amalfi-coast-escape", Title: "Amalfi Coast", Kind: "bundle",
				Subtitle: "ویلای صخره‌ای با استخر بی‌نهایت + خودروی روباز",
				BodyMD:   "هفت شب در ویلایی مشرف به دریای تیرنه، با یک خودروی روباز برای جاده‌های ساحلی.",
				Spec: map[string]any{
					"location": "Amalfi, Italy", "nights": 7, "guests": 6, "car": "Ferrari Portofino",
				},
				ValueCents: 5200000,
				HeroImage:  "https://images.unsplash.com/photo-1533165850316-ee1ba9a3b4b8?w=1600&q=80",
			},
			media: []string{
				"https://images.unsplash.com/photo-1533165850316-ee1ba9a3b4b8?w=1600&q=80",
				"https://images.unsplash.com/photo-1516483638261-f4dbaf036963?w=1600&q=80",
			},
		},
		{
			in: store.PrizeInput{
				Slug: "swiss-alps-chalet", Title: "Swiss Alps", Kind: "bundle",
				Subtitle: "شالهٔ کوهستانی + شاسی‌بلند لوکس",
				BodyMD:   "یک هفته در شالهٔ چوبی آلپ سوئیس با مسیرهای رانندگی کوهستانی افسانه‌ای.",
				Spec: map[string]any{
					"location": "Zermatt, Switzerland", "nights": 7, "guests": 8,
					"car": "Mercedes-AMG G 63",
				},
				ValueCents: 4800000,
				HeroImage:  "https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1600&q=80",
			},
			media: []string{"https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1600&q=80"},
		},
		{
			in: store.PrizeInput{
				Slug: "santorini-cyclades", Title: "Santorini, Cyclades", Kind: "bundle",
				Subtitle: "خانهٔ غار صخره‌ای + قایق خصوصی",
				BodyMD:   "غروب‌های اویا از استخر بی‌نهایت خصوصی خودت، به‌علاوهٔ یک روز قایق‌سواری.",
				Spec: map[string]any{
					"location": "Oia, Greece", "nights": 7, "guests": 4, "car": "Mini Cooper S Cabrio",
				},
				ValueCents: 3900000,
				HeroImage:  "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&q=80",
			},
			media: []string{"https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1600&q=80"},
		},
	}

	prizeIDs := map[string]uuid.UUID{}
	for _, ps := range prizes {
		p, err := st.CreatePrize(ctx, ps.in)
		if err != nil {
			log.Printf("prize %s already exists, skipping", ps.in.Slug)
			continue
		}
		prizeIDs[p.Slug] = p.ID
		for i, url := range ps.media {
			_ = st.AddPrizeMedia(ctx, p.ID, url, "", i)
		}
	}
	log.Printf("seeded %d prizes", len(prizeIDs))

	if len(prizeIDs) == 0 {
		log.Println("prizes already present — skipping competition seed")
		return
	}

	// ---------- مسابقات ----------
	// تصویر بازی: عکس فوتبال (در محصول واقعی باید توپ حذف شده باشد)
	const board = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&q=80"
	now := time.Now()

	comps := []store.CompetitionInput{
		{
			Slug: "kish-week-01", PrizeID: prizeIDs["kish-island-dream-week"],
			Title: "هفته رویایی جزیره کیش", TicketPriceCents: 300, Currency: "CAD",
			BoardImage: board, OpensAt: now.Add(-48 * time.Hour),
			ClosesAt: now.Add(5 * 24 * time.Hour), Status: "open", MaxEntriesUser: 100,
		},
		{
			Slug: "amalfi-week-01", PrizeID: prizeIDs["amalfi-coast-escape"],
			Title: "Amalfi Coast Dream Week", TicketPriceCents: 300, Currency: "CAD",
			BoardImage: board, OpensAt: now.Add(-24 * time.Hour),
			ClosesAt: now.Add(9 * 24 * time.Hour), Status: "open", MaxEntriesUser: 100,
		},
		{
			Slug: "alps-week-00", PrizeID: prizeIDs["swiss-alps-chalet"],
			Title: "Swiss Alps Dream Week", TicketPriceCents: 300, Currency: "CAD",
			BoardImage: board, OpensAt: now.Add(-21 * 24 * time.Hour),
			ClosesAt: now.Add(-14 * 24 * time.Hour), Status: "closed", MaxEntriesUser: 100,
		},
	}

	compIDs := map[string]uuid.UUID{}
	for _, ci := range comps {
		c, err := st.CreateCompetition(ctx, ci)
		if err != nil {
			log.Printf("competition %s: %v", ci.Slug, err)
			continue
		}
		compIDs[c.Slug] = c.ID
	}
	log.Printf("seeded %d competitions", len(compIDs))

	// ---------- ورودی‌های نمونه ----------
	players := []string{"james@example.com", "priya@example.com", "marc@example.com",
		"sara@example.com", "tom@example.com"}

	for slug, id := range compIDs {
		c, _ := st.CompetitionByID(ctx, id)
		if c.Status != "open" {
			// مسابقهٔ بسته را موقتاً باز می‌کنیم تا بتوان ورودی ثبت کرد
			_ = st.SetCompetitionStatus(ctx, id, "open")
		}
		for i, email := range players {
			picks := []store.Point{}
			for j := 0; j < 3; j++ {
				picks = append(picks, store.Point{
					X: 0.40 + float64((i*3+j)%13)*0.015,
					Y: 0.35 + float64((i*2+j)%11)*0.018,
				})
			}
			if _, err := st.Checkout(ctx, users[email].ID,
				[]store.CartLine{{CompetitionSlug: slug, Picks: picks}}, "mock", false); err != nil {
				log.Printf("entries for %s/%s: %v", slug, email, err)
			}
		}
		if c.Status != "open" {
			_ = st.SetCompetitionStatus(ctx, id, c.Status)
		}
	}
	log.Println("seeded sample entries")

	// ---------- داوری مسابقهٔ بسته‌شده ----------
	if id, ok := compIDs["alps-week-00"]; ok {
		judgeVotes := []struct {
			email string
			x, y  float64
			nonce string
		}{
			{"judge1@panel.example", 0.462, 0.388, "nonce-alps-a"},
			{"judge2@panel.example", 0.455, 0.396, "nonce-alps-b"},
			{"judge3@panel.example", 0.470, 0.381, "nonce-alps-c"},
		}
		// تعهدها باید پیش از بسته‌شدن ثبت شوند
		_ = st.SetCompetitionStatus(ctx, id, "open")
		for _, v := range judgeVotes {
			h := store.CommitHash(v.x, v.y, v.nonce)
			if err := st.Commit(ctx, id, users[v.email].ID, h); err != nil {
				log.Printf("commit %s: %v", v.email, err)
			}
		}
		_ = st.SetCompetitionStatus(ctx, id, "closed")
		for _, v := range judgeVotes {
			if err := st.Reveal(ctx, id, users[v.email].ID, v.x, v.y, v.nonce); err != nil {
				log.Printf("reveal %s: %v", v.email, err)
			}
		}
		res, err := st.Settle(ctx, id)
		if err != nil {
			log.Printf("settle: %v", err)
		} else {
			log.Printf("settled alps-week-00 — final point (%.4f, %.4f)", res.FinalX, res.FinalY)
			_ = st.SetResultVideo(ctx, id, "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
		}
	}

	// ---------- صفحات CMS ----------
	pages := []store.PageInput{
		{Slug: "how-it-works", Title: "چطور کار می‌کند", Published: true, BodyMD: `
## یک بازی مهارتی واقعی. شفاف در طراحی.

بدون قرعه‌کشی تصادفی. بدون شانس مبهم. فقط یک آزمون واقعی قضاوت — با مسیر رایگان ورود
و بازگشت وجه اگر دوره فعال نشد.

1. **ورودی‌هایت را بگیر** — یک بسته پیشنهاد بخر، یا با اشتراک‌گذاری یک ورودی رایگان بگیر.
2. **توپ را نشانه بگیر** — عکس را بررسی کن و جایی که فکر می‌کنی مرکز توپ است علامت بزن.
3. **داوران + سؤال مهارتی** — یک هیئت کارشناسی مستقل نقطهٔ رسمی را تعیین می‌کند.
4. **برد یا بازگشت وجه** — اگر دوره به حدنصاب نرسد، ورودی‌هایت برگردانده می‌شود.`},
		{Slug: "rules", Title: "قوانین", Published: true, BodyMD: `
## قوانین مسابقه

- برنده کسی است که مختصاتش به رأی **هیئت داوران** نزدیک‌ترین باشد — نه به موقعیت واقعی توپ.
- داوران پیش از بسته‌شدن دوره، رأی خود را به‌صورت هشِ رمزنگاری‌شده ثبت می‌کنند (commit)
  و تنها پس از بسته‌شدن آن را آشکار می‌کنند (reveal). بنابراین هیچ‌کس — حتی کارکنان —
  پاسخ را از پیش نمی‌داند.
- کارکنان، پیمانکاران و بستگان درجه‌یک آن‌ها حق شرکت ندارند.
- در تساوی، ورودی‌ای که زودتر ثبت شده برنده است.`},
		{Slug: "free-entry", Title: "مسیر رایگان (AMOE)", Published: true, BodyMD: `
## ورودی رایگان — خرید لازم نیست

یک ورودی رایگان دقیقاً برابر ورودی پولی است. برای دریافت آن، ویدیوی جایزهٔ این دوره را
به اشتراک بگذار یا فرم پستی را تکمیل کن. هر حساب در هر دوره یک ورودی رایگان می‌گیرد.`},
		{Slug: "terms", Title: "شرایط", Published: true, BodyMD: "شرایط و ضوابط کامل اینجا قرار می‌گیرد."},
		{Slug: "privacy", Title: "حریم خصوصی", Published: true, BodyMD: "سیاست حریم خصوصی اینجا قرار می‌گیرد."},
		{Slug: "responsible-play", Title: "بازی مسئولانه", Published: true, BodyMD: `
## بازی مسئولانه

سقف هزینهٔ هفتگی تعیین کن و به آن پایبند بمان. اگر احساس می‌کنی کنترل از دستت خارج شده،
از تنظیمات حساب می‌توانی حساب خود را موقتاً محدود کنی.`},
	}
	for _, p := range pages {
		if _, err := st.UpsertPage(ctx, p); err != nil {
			log.Printf("page %s: %v", p.Slug, err)
		}
	}
	log.Printf("seeded %d pages", len(pages))

	// ---------- تنظیمات سایت ----------
	settings := map[string]any{
		"brand": map[string]any{
			"name": "به سوی رویا", "name_en": "Aim Dream Win",
			"tagline": "یک بلیط. به سوی رویا نشانه بگیر.",
		},
		"theme": map[string]any{
			"primary": "#F0A828", "ink": "#1E2A47", "bg": "#FAF7F2", "radius": "16px",
		},
		"nav": []any{
			map[string]any{"label": "خانه", "href": "/"},
			map[string]any{"label": "بازی", "href": "/play"},
			map[string]any{"label": "چطور کار می‌کند", "href": "/how-it-works"},
			map[string]any{"label": "شرکت‌های من", "href": "/my-entries"},
			map[string]any{"label": "کیف پول", "href": "/wallet"},
			map[string]any{"label": "برندگان", "href": "/winners"},
		},
		"banner": map[string]any{
			"enabled": true,
			"text":    "دورهٔ این هفته باز است — تا یکشنبه نیمه‌شب نشانه بگیر.",
		},
		"packs": []any{
			map[string]any{"entries": 1, "price_cents": 300, "label": "شروع", "discount": 0},
			map[string]any{"entries": 5, "price_cents": 1200, "label": "روزمره", "discount": 20, "popular": true},
			map[string]any{"entries": 20, "price_cents": 4000, "label": "بازیگر بزرگ", "discount": 33},
		},
	}
	for k, v := range settings {
		if err := st.SetSetting(ctx, k, v); err != nil {
			log.Printf("setting %s: %v", k, err)
		}
	}
	log.Println("seeded site settings")
	log.Println("done — sign in as admin@besooyeroya.com / password123")
}
