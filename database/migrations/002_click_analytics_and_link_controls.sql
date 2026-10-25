BEGIN;

ALTER TABLE links
	ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
	ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS click_events (
	id BIGSERIAL PRIMARY KEY,
	link_id INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
	country_code CHAR(2),
	created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
	CONSTRAINT click_events_country_code_format
		CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS click_events_link_created_idx
	ON click_events (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS click_events_country_created_idx
	ON click_events (country_code, created_at DESC);

COMMIT;
