module.exports = function createUsersRepository(db) {
	return {
		findAll: async () => {
			const result = await db.query("SELECT * FROM users");
			return result.rows;
		},
		create: async (name, email) => {
			await db.query("INSERT INTO users (name, email) VALUES ($1, $2)", [
				name,
				email,
			]);
		},
	};
};
