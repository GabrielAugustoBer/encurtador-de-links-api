module.exports = function createUsersRepository(db) {
	return {
		findAll: async () => {
			const result = await db.query(
				"SELECT id, name, email, role FROM users ORDER BY id",
			);
			return result.rows;
		},
		findByEmail: async (email) => {
			const result = await db.query(
				"SELECT id, name, email, role, password_hash FROM users WHERE LOWER(email) = $1",
				[email],
			);
			return result.rows[0] ?? null;
		},
		updateProfile: async (id, name, email) => {
			const result = await db.query(
				`UPDATE users
				SET name = $1, email = $2
				WHERE id = $3
				RETURNING id, name, email, role`,
				[name, email, id],
			);
			return result.rows[0] ?? null;
		},
		updatePassword: async (id, passwordHash) => {
			const result = await db.query(
				"UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id",
				[passwordHash, id],
			);
			return result.rows.length > 0;
		},
		create: async (name, email, passwordHash) => {
			const result = await db.query(
				"INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role",
				[name, email, passwordHash],
			);
			return result.rows[0];
		},
	};
};
