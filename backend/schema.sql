-- ============================================================================
-- Logi-Pro PostgreSQL Schema — 14 tables
-- ============================================================================

-- 1. Users (authentication & authorization)
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  username      VARCHAR(50)  UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL DEFAULT '',
  role          VARCHAR(20)  NOT NULL DEFAULT 'guest',  -- admin | thuongvu | guest
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Migration: add display_name if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='display_name') THEN
    ALTER TABLE users ADD COLUMN display_name VARCHAR(100) NOT NULL DEFAULT '';
  END IF;
END $$;

-- 2. Fuel prices
CREATE TABLE IF NOT EXISTS fuel_prices (
  id           SERIAL PRIMARY KEY,
  date         DATE         NOT NULL UNIQUE,
  fuel_type    VARCHAR(50)  NOT NULL DEFAULT 'Dầu DO 0,05S-II',
  price_v1     INTEGER      NOT NULL,
  is_published BOOLEAN      NOT NULL DEFAULT FALSE
);

-- Migration: add is_published if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_prices' AND column_name='is_published') THEN
    ALTER TABLE fuel_prices ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

-- Migration: add effective_at for surcharge offset logic (08:00 AM rule)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fuel_prices' AND column_name='effective_at') THEN
    ALTER TABLE fuel_prices ADD COLUMN effective_at TEXT;
  END IF;
END $$;

-- Deduplicate legacy rows (keep lowest id per date)
DELETE FROM fuel_prices a
  USING fuel_prices b
  WHERE a.date = b.date
    AND a.id > b.id;

-- Ensure unique constraint exists (idempotent)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fuel_prices_date_key'
  ) THEN
    ALTER TABLE fuel_prices ADD CONSTRAINT fuel_prices_date_key UNIQUE (date);
  END IF;
END $$;

-- 3. Container surcharge tiers
CREATE TABLE IF NOT EXISTS tiers (
  id            SERIAL PRIMARY KEY,
  min_price     INTEGER NOT NULL,
  max_price     INTEGER NOT NULL,
  surcharge_20f INTEGER NOT NULL DEFAULT 0,
  surcharge_40f INTEGER NOT NULL DEFAULT 0,
  surcharge_20e INTEGER NOT NULL DEFAULT 0,
  surcharge_40e INTEGER NOT NULL DEFAULT 0
);

-- 4. Bulk cargo surcharge tiers
CREATE TABLE IF NOT EXISTS bulk_tiers (
  id                 SERIAL PRIMARY KEY,
  min_price          INTEGER      NOT NULL,
  max_price          INTEGER      NOT NULL,
  percent_surcharge  NUMERIC(5,2) NOT NULL DEFAULT 0
);

-- 5. Customers
CREATE TABLE IF NOT EXISTS customers (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(255) NOT NULL,
  email    VARCHAR(255),
  phone    VARCHAR(50),
  address  TEXT,
  tax_code VARCHAR(20),
  status   VARCHAR(10)  NOT NULL DEFAULT 'active'
);

-- 6. Services / Products
CREATE TABLE IF NOT EXISTS services (
  id       SERIAL PRIMARY KEY,
  name     VARCHAR(255) NOT NULL,
  unit     VARCHAR(20)  NOT NULL,
  price    INTEGER      NOT NULL DEFAULT 0,
  category VARCHAR(50)
);

-- 7. Quotations (header)
CREATE TABLE IF NOT EXISTS quotations (
  id            SERIAL PRIMARY KEY,
  quotation_no  VARCHAR(50),
  customer_name VARCHAR(255),
  date          DATE,
  total         BIGINT       NOT NULL DEFAULT 0,
  status        VARCHAR(10)  NOT NULL DEFAULT 'draft',
  created_by    VARCHAR(50)
);

-- 8. Quotation line items
CREATE TABLE IF NOT EXISTS quotation_items (
  id           SERIAL PRIMARY KEY,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  name         VARCHAR(255),
  unit         VARCHAR(20),
  quantity     INTEGER NOT NULL DEFAULT 0,
  price        INTEGER NOT NULL DEFAULT 0,
  total        BIGINT  NOT NULL DEFAULT 0,
  note         TEXT
);

-- 9. Reconciliation logs
CREATE TABLE IF NOT EXISTS reconciliation_logs (
  id                    SERIAL PRIMARY KEY,
  container_id          VARCHAR(20),
  container_type        VARCHAR(5),
  booking_date          DATE,
  check_date            DATE,
  fuel_price_at_booking INTEGER NOT NULL DEFAULT 0,
  fuel_price_now        INTEGER NOT NULL DEFAULT 0,
  surcharge_at_booking  INTEGER NOT NULL DEFAULT 0,
  surcharge_now         INTEGER NOT NULL DEFAULT 0,
  delta                 INTEGER NOT NULL DEFAULT 0,
  status                VARCHAR(10),
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. Registration services catalog
CREATE TABLE IF NOT EXISTS registration_services (
  id   SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20)  NOT NULL
);

-- 11. Registrations (header)
CREATE TABLE IF NOT EXISTS registrations (
  id                  SERIAL PRIMARY KEY,
  registration_number VARCHAR(50),
  registration_date   DATE,
  customer_name       VARCHAR(255),
  customer_address    TEXT,
  customer_phone      VARCHAR(50),
  working_date        DATE,
  cargo_type          VARCHAR(50),
  container_type      VARCHAR(50),
  customer_notes      TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Registration line items
CREATE TABLE IF NOT EXISTS registration_items (
  id              SERIAL PRIMARY KEY,
  registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  service_name    VARCHAR(255),
  size            VARCHAR(10),
  quantity        INTEGER NOT NULL DEFAULT 0
);

-- 13. Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id        SERIAL PRIMARY KEY,
  action    VARCHAR(100) NOT NULL,
  details   TEXT,
  timestamp TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 14. App config (key-value)
CREATE TABLE IF NOT EXISTS app_config (
  key   VARCHAR(50) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'
);

-- Default admin user is created by backend/seed.ts during bootstrap.

-- Default fallback config
INSERT INTO app_config (key, value)
VALUES ('fallback', '{"price": 35440, "date": "2026-03-26"}')
ON CONFLICT (key) DO NOTHING;
