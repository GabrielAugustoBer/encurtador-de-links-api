module.exports = function createAuthRepository(db) {
	return {
		authenticate: async (userId, tokenId) => {
			const result = await db.query(
				`SELECT id, name, email, role
				FROM users
				WHERE id = $1
					AND NOT EXISTS (
						SELECT 1 FROM revoked_tokens WHERE token_id = $2
					)`,
				[userId, tokenId],
			);
			return result.rows[0] ?? null;
		},
		revokeToken: async (tokenId, expiresAt) => {
			await db.query(
				`WITH expired_tokens AS (
					DELETE FROM revoked_tokens WHERE expires_at <= NOW()
					RETURNING token_id
				)
				INSERT INTO revoked_tokens (token_id, expires_at)
				VALUES ($1, $2)
				ON CONFLICT (token_id) DO NOTHING`,
				[tokenId, expiresAt],
			);
		},
	};
};
