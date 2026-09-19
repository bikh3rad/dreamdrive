// دادهٔ نمایشی — فقط وقتی API در دسترس نیست استفاده می‌شود تا صفحه خالی نماند.
//
// هر مسابقهٔ نمونه باید آرایهٔ prizes داشته باشد؛ بدون آن صفحهٔ بازی هیچ سطح
// قابل انتخابی پیدا نمی‌کند و دکمه‌های خرید برای همیشه غیرفعال می‌مانند —
// که شبیه خرابی سایت دیده می‌شود، نه شبیه «API در دسترس نیست».
import type { Competition, Winner } from "./api";

const alpsPrize = {
  id: "p1",
  slug: "alps-porsche",
  title: "ویلای آلپ + پورشه ۹۱۱ کررا",
  kind: "villa_car",
  subtitle: "هفت شب در شامونی، با یک ۹۱۱ در گاراژ",
  body_md: "",
  spec: {},
  value_cents: 185_000_000_000,
  hero_image:
    "https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1600&q=80",
};

const alpsSecondPrize = {
  id: "p1b",
  slug: "alps-weekend",
  title: "آخر هفته در شامونی",
  kind: "trip",
  subtitle: "دو شب اقامت، بدون خودرو",
  body_md: "",
  spec: {},
  value_cents: 9_000_000_000,
  hero_image:
    "https://images.unsplash.com/photo-1551524164-687a55dd1126?w=1600&q=80",
};

const amalfiPrize = {
  id: "p2",
  slug: "amalfi-defender",
  title: "ویلای آمالفی + لندرور دفندر ۱۱۰",
  kind: "villa_car",
  subtitle: "هفت شب رو به دریا، با دفندری برای جاده‌های ساحلی",
  body_md: "",
  spec: {},
  value_cents: 152_000_000_000,
  hero_image:
    "https://images.unsplash.com/photo-1533165850316-ee1ba9a3b4b8?w=1600&q=80",
};

export const FALLBACK_COMPETITIONS: Competition[] = [
  {
    id: "demo-1",
    slug: "alps-week-01",
    title: "هفته‌ای در آلپ + پورشه ۹۱۱",
    currency: "IRR",
    board_image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&q=80",
    opens_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    closes_at: new Date(Date.now() + 5 * 86400000).toISOString(),
    status: "open",
    max_entries_user: 100,
    entry_target: 20_000,
    entry_count: 8421,
    // عمداً دو سطح، تا حالت چندجایزه‌ای در دادهٔ نمونه هم دیده شود.
    prizes: [
      {
        id: "cp1a",
        competition_id: "demo-1",
        prize_id: "p1",
        ticket_price_cents: 10_000_000,
        sort: 0,
        is_active: true,
        prize: alpsPrize,
      },
      {
        id: "cp1b",
        competition_id: "demo-1",
        prize_id: "p1b",
        ticket_price_cents: 5_000_000,
        sort: 1,
        is_active: true,
        prize: alpsSecondPrize,
      },
    ],
    prize: alpsPrize,
  },
  {
    id: "demo-2",
    slug: "amalfi-week-02",
    title: "ساحل آمالفی + دفندر ۱۱۰",
    currency: "IRR",
    board_image:
      "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1600&q=80",
    opens_at: new Date(Date.now() - 86400000).toISOString(),
    closes_at: new Date(Date.now() + 12 * 86400000).toISOString(),
    status: "open",
    max_entries_user: 100,
    entry_target: 20_000,
    entry_count: 3190,
    prizes: [
      {
        id: "cp2a",
        competition_id: "demo-2",
        prize_id: "p2",
        ticket_price_cents: 8_000_000,
        sort: 0,
        is_active: true,
        prize: amalfiPrize,
      },
    ],
    prize: amalfiPrize,
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
