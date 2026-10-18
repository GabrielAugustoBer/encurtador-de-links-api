module.exports = function createLinksRepository(db) {
	return {
		findAll: async () => {
			const result = await db.query(
				"SELECT * FROM links ORDER BY created_at DESC",
			);
			return result.rows;
		},
		create: async (shortCode, longURL) => {
			await db.query(
				"INSERT INTO links (short_code, long_url) VALUES ($1, $2)",
				[shortCode, longURL],
			);
		},
		findByShortCode: async (shortCode) => {
			const result = await db.query(
				"SELECT * FROM links WHERE short_code = $1",
				[shortCode],
			);
			return result.rows[0] ?? null;
		},
		incrementClicks: async (shortCode) => {
			await db.query(
				"UPDATE links SET clicks = clicks + 1 WHERE short_code = $1",
				[shortCode],
			);
		},
		deleteByShortCode: async (shortCode) => {
			const result = await db.query(
				"DELETE FROM links WHERE short_code = $1 RETURNING *",
				[shortCode],
			);
			return result.rows.length > 0;
		},
	};
};
