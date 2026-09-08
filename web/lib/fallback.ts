// دادهٔ نمایشی — فقط وقتی API در دسترس نیست استفاده می‌شود تا صفحه خالی نماند.
import type { Competition, Winner } from "./api";

export const FALLBACK_COMPETITIONS: Competition[] = [
  {
    id: "demo-1",
    slug: "alps-week-01",
    prize_id: "p1",
    title: "هفته‌ای در آلپ + پورشه ۹۱۱",
    ticket_price_cents: 300,
    currency: "CAD",
    board_image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&q=80",
    opens_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    closes_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: "open",
    max_entries_user: 100,
    entry_count: 8421,
    prize: {
      id: "p1",
      slug: "alps-porsche",
      title: "ویلای آلپ + پورشه ۹۱۱ کررا",
      kind: "villa_car",
      subtitle: "هفت شب در شامونی، با یک ۹۱۱ در گاراژ",
      body_md: "",
      spec: {},
      value_cents: 18500000,
      hero_image:
        "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80",
    },
  },
  {
    id: "demo-2",
    slug: "amalfi-week-02",
    prize_id: "p2",
    title: "ساحل آمالفی + دفندر ۱۱۰",
    ticket_price_cents: 300,
    currency: "CAD",
    board_image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&q=80",
    opens_at: new Date(Date.now() - 86400000).toISOString(),
    closes_at: new Date(Date.now() + 12 * 86400000).toISOString(),
    status: "open",
    max_entries_user: 100,
    entry_count: 3190,
    prize: {
      id: "p2",
      slug: "amalfi-defender",
      title: "ویلای آمالفی + لندرور دفندر ۱۱۰",
      kind: "villa_car",
      subtitle: "هفت شب رو به دریا، با دفندری برای جاده‌های ساحلی",
      body_md: "",
      spec: {},
      value_cents: 15200000,
      hero_image:
        "https://images.unsplash.com/photo-1533165850316-ee1ba9a3b4b8?w=1600&q=80",
    },
  },
];

export const FALLBACK_WINNERS: Winner[] = [
  {
    competition_slug: "alps-week-00",
    competition_title: "هفته‌ای در آلپ + پورشه ۹۱۱",
    prize_title: "ویلای آلپ + پورشه ۹۱۱ کررا",
    hero_image:
      "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1200&q=80",
    winner_name: "لوکاس م.",
    country: "پرتغال",
    video_url: "",
    decided_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    competition_slug: "coast-week-99",
    competition_title: "ساحل آمالفی + دفندر ۱۱۰",
    prize_title: "ویلای آمالفی + لندرور دفندر ۱۱۰",
    hero_image:
      "https://images.unsplash.com/photo-1533165850316-ee1ba9a3b4b8?w=1200&q=80",
    winner_name: "سوفیا ر.",
    country: "اسپانیا",
    video_url: "",
    decided_at: new Date(Date.now() - 48 * 86400000).toISOString(),
  },
  {
    competition_slug: "nordic-week-98",
    competition_title: "کلبهٔ نروژ + ولوو EX90",
    prize_title: "کلبهٔ فیورد + ولوو EX90",
    hero_image:
      "https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1200&q=80",
    winner_name: "ینس ک.",
    country: "دانمارک",
    video_url: "",
    decided_at: new Date(Date.now() - 76 * 86400000).toISOString(),
  },
];
