module.exports = function createLinksRepository(db) {
	return {
		findAll: async (userId) => {
			const result = await db.query(
				`SELECT id, short_code, long_url, clicks, created_at, is_active, expires_at
				FROM links WHERE user_id = $1 ORDER BY created_at DESC`,
				[userId],
			);
			return result.rows;
		},
		create: async (shortCode, longURL, userId) => {
			await db.query(
				"INSERT INTO links (short_code, long_url, user_id) VALUES ($1, $2, $3)",
				[shortCode, longURL, userId],
			);
		},
		findByShortCode: async (shortCode) => {
			const result = await db.query(
				`SELECT id, short_code, long_url, clicks, created_at, is_active, expires_at
				FROM links WHERE short_code = $1`,
				[shortCode],
			);
			return result.rows[0] ?? null;
		},
		findByShortCodeAndUser: async (shortCode, userId) => {
			const result = await db.query(
				`SELECT id, short_code, long_url, clicks, created_at, is_active, expires_at
				FROM links WHERE short_code = $1 AND user_id = $2`,
				[shortCode, userId],
			);
			return result.rows[0] ?? null;
		},
		updateByShortCodeAndUser: async (shortCode, userId, longURL) => {
			const result = await db.query(
				`UPDATE links
				SET long_url = $1
				WHERE short_code = $2 AND user_id = $3
				RETURNING id, short_code, long_url, clicks, created_at, is_active, expires_at`,
				[longURL, shortCode, userId],
			);
			return result.rows[0] ?? null;
		},
		updateSettings: async (shortCode, userId, settings) => {
			const result = await db.query(
				`UPDATE links
				SET expires_at = CASE WHEN $1 THEN $2 ELSE expires_at END,
					is_active = CASE WHEN $3 THEN $4 ELSE is_active END
				WHERE short_code = $5 AND user_id = $6
				RETURNING id, short_code, long_url, clicks, created_at, is_active, expires_at`,
				[
					settings.hasExpiresAt,
					settings.expiresAt,
					settings.hasIsActive,
					settings.isActive,
					shortCode,
					userId,
				],
			);
			return result.rows[0] ?? null;
		},
		setActive: async (shortCode, userId, isActive) => {
			const result = await db.query(
				`UPDATE links SET is_active = $1
				WHERE short_code = $2 AND user_id = $3
				RETURNING id`,
				[isActive, shortCode, userId],
			);
			return result.rows.length > 0;
		},
		recordClickAndGetDestination: async (shortCode, countryCode) => {
			const result = await db.query(
				`WITH redirectable AS (
					SELECT id, long_url FROM links
					WHERE short_code = $1
						AND is_active = TRUE
						AND (expires_at IS NULL OR expires_at > NOW())
				),
				updated AS (
					UPDATE links AS link
					SET clicks = COALESCE(link.clicks, 0) + 1
					FROM redirectable
					WHERE link.id = redirectable.id
					RETURNING link.id, link.long_url
				),
				recorded AS (
					INSERT INTO click_events (link_id, country_code)
					SELECT id, $2 FROM updated
					RETURNING link_id
				)
				SELECT updated.long_url
				FROM updated
				JOIN recorded ON recorded.link_id = updated.id`,
				[shortCode, countryCode],
			);
			return result.rows[0]?.long_url ?? null;
		},
		getAnalyticsSummary: async (shortCode, userId, from, to) => {
			const result = await db.query(
				`SELECT COUNT(events.id)::INTEGER AS clicks,
					COUNT(DISTINCT (events.created_at AT TIME ZONE 'UTC')::DATE)::INTEGER AS active_days
				FROM links
				LEFT JOIN click_events AS events
					ON events.link_id = links.id
					AND events.created_at >= ($3::DATE::TIMESTAMP AT TIME ZONE 'UTC')
					AND events.created_at < (($4::DATE + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'UTC')
				WHERE links.short_code = $1 AND links.user_id = $2`,
				[shortCode, userId, from, to],
			);
			return result.rows[0] ?? null;
		},
		getCountryAnalytics: async (shortCode, userId, from, to) => {
			const result = await db.query(
				`SELECT COALESCE(events.country_code::TEXT, 'unknown') AS country,
					COUNT(events.id)::INTEGER AS clicks
				FROM links
				LEFT JOIN click_events AS events
					ON events.link_id = links.id
					AND events.created_at >= ($3::DATE::TIMESTAMP AT TIME ZONE 'UTC')
					AND events.created_at < (($4::DATE + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'UTC')
				WHERE links.short_code = $1 AND links.user_id = $2
				GROUP BY events.country_code
				HAVING COUNT(events.id) > 0
				ORDER BY clicks DESC, country ASC`,
				[shortCode, userId, from, to],
			);
			return result.rows;
		},
		getDailyAnalytics: async (shortCode, userId, from, to) => {
			const result = await db.query(
				`SELECT (events.created_at AT TIME ZONE 'UTC')::DATE AS date,
					COUNT(events.id)::INTEGER AS clicks
				FROM links
				LEFT JOIN click_events AS events
					ON events.link_id = links.id
					AND events.created_at >= ($3::DATE::TIMESTAMP AT TIME ZONE 'UTC')
					AND events.created_at < (($4::DATE + INTERVAL '1 day')::TIMESTAMP AT TIME ZONE 'UTC')
				WHERE links.short_code = $1 AND links.user_id = $2
				GROUP BY (events.created_at AT TIME ZONE 'UTC')::DATE
				ORDER BY date ASC`,
				[shortCode, userId, from, to],
			);
			return result.rows;
		},
		deleteByShortCode: async (shortCode, userId) => {
			const result = await db.query(
				"DELETE FROM links WHERE short_code = $1 AND user_id = $2 RETURNING *",
				[shortCode, userId],
			);
			return result.rows.length > 0;
		},
	};
};
