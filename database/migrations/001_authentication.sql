BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users
	ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
	CHECK (role IN ('user', 'admin'));

ALTER TABLE links ADD COLUMN IF NOT EXISTS user_id INTEGER;

-- Legacy links were explicitly excluded from the authenticated ownership model.
DELETE FROM links WHERE user_id IS NULL;

ALTER TABLE links ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE links
	ADD CONSTRAINT links_user_id_fkey
	FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx
	ON users (LOWER(email));
CREATE INDEX IF NOT EXISTS links_user_id_idx ON links (user_id);

CREATE TABLE IF NOT EXISTS revoked_tokens (
	token_id UUID PRIMARY KEY,
	expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS revoked_tokens_expires_at_idx
	ON revoked_tokens (expires_at);

COMMIT;
