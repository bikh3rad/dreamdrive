-- DreamDrive schema
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    full_name       TEXT NOT NULL DEFAULT '',
    country         TEXT NOT NULL DEFAULT '',
    role            TEXT NOT NULL DEFAULT 'user'
                    CHECK (role IN ('user','support','content_admin','finance_admin','superadmin','judge')),
    kyc_status      TEXT NOT NULL DEFAULT 'none'
                    CHECK (kyc_status IN ('none','pending','verified','rejected')),
    credit_cents    BIGINT NOT NULL DEFAULT 0,
    is_blocked      BOOLEAN NOT NULL DEFAULT FALSE,
    is_insider      BOOLEAN NOT NULL DEFAULT FALSE,  -- کارکنان/مرتبطین: حق شرکت ندارند
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prizes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug        TEXT NOT NULL UNIQUE,
    title       TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'bundle' CHECK (kind IN ('car','villa','bundle','lifestyle','cash')),
    subtitle    TEXT NOT NULL DEFAULT '',
    body_md     TEXT NOT NULL DEFAULT '',
    spec        JSONB NOT NULL DEFAULT '{}'::jsonb,
    value_cents BIGINT NOT NULL DEFAULT 0,
    hero_image  TEXT NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS prize_media (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prize_id UUID NOT NULL REFERENCES prizes(id) ON DELETE CASCADE,
    url      TEXT NOT NULL,
    caption  TEXT NOT NULL DEFAULT '',
    sort     INT  NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS competitions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug               TEXT NOT NULL UNIQUE,
    prize_id           UUID NOT NULL REFERENCES prizes(id) ON DELETE RESTRICT,
    title              TEXT NOT NULL,
    ticket_price_cents BIGINT NOT NULL DEFAULT 200,
    currency           TEXT NOT NULL DEFAULT 'EUR',
    board_image        TEXT NOT NULL DEFAULT '',   -- تصویر بازی (بدون توپ)
    opens_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    closes_at          TIMESTAMPTZ NOT NULL,
    status             TEXT NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('draft','open','closed','judging','settled','cancelled')),
    max_entries_user   INT NOT NULL DEFAULT 0,     -- 0 = نامحدود
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comp_status ON competitions(status, closes_at);

CREATE TABLE IF NOT EXISTS orders (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    total_cents  BIGINT NOT NULL DEFAULT 0,
    currency     TEXT NOT NULL DEFAULT 'EUR',
    status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','paid','failed','refunded','free')),
    provider     TEXT NOT NULL DEFAULT 'mock',
    provider_ref TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    competition_id   UUID NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
    qty              INT NOT NULL CHECK (qty > 0),
    unit_price_cents BIGINT NOT NULL
);

-- ورودی‌ها: مختصات انتخابی کاربر، با زنجیرهٔ هش برای تشخیص دستکاری
CREATE TABLE IF NOT EXISTS entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE RESTRICT,
    order_id       UUID REFERENCES orders(id) ON DELETE SET NULL,
    x              DOUBLE PRECISION NOT NULL CHECK (x >= 0 AND x <= 1),
    y              DOUBLE PRECISION NOT NULL CHECK (y >= 0 AND y <= 1),
    is_free_entry  BOOLEAN NOT NULL DEFAULT FALSE,
    seq            BIGINT NOT NULL,
    prev_hash      TEXT NOT NULL DEFAULT '',
    hash           TEXT NOT NULL DEFAULT '',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_entries_comp ON entries(competition_id, seq);
CREATE INDEX IF NOT EXISTS idx_entries_user ON entries(user_id, created_at DESC);

-- داوری commit–reveal
CREATE TABLE IF NOT EXISTS judge_commits (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    judge_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    commit_hash    TEXT NOT NULL,
    committed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (competition_id, judge_id)
);

CREATE TABLE IF NOT EXISTS judge_reveals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    competition_id UUID NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
    judge_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    x              DOUBLE PRECISION NOT NULL,
    y              DOUBLE PRECISION NOT NULL,
    nonce          TEXT NOT NULL,
    revealed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (competition_id, judge_id)
);

CREATE TABLE IF NOT EXISTS results (
    competition_id  UUID PRIMARY KEY REFERENCES competitions(id) ON DELETE CASCADE,
    final_x         DOUBLE PRECISION NOT NULL,
    final_y         DOUBLE PRECISION NOT NULL,
    winner_entry_id UUID REFERENCES entries(id) ON DELETE SET NULL,
    winner_user_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    distance        DOUBLE PRECISION NOT NULL DEFAULT 0,
    video_url       TEXT NOT NULL DEFAULT '',
    decided_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CMS
CREATE TABLE IF NOT EXISTS pages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug       TEXT NOT NULL UNIQUE,
    title      TEXT NOT NULL,
    body_md    TEXT NOT NULL DEFAULT '',
    published  BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS site_settings (
    key        TEXT PRIMARY KEY,
    value      JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         BIGSERIAL PRIMARY KEY,
    actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    action     TEXT NOT NULL,
    target     TEXT NOT NULL DEFAULT '',
    meta       JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip         TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
