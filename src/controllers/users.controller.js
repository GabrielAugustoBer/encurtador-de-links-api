module.exports = function usersController(db) {
	return {
		getAllUsers: async (_req, res) => {
			try {
				const queryText = "SELECT * FROM users";
				const result = await db.query(queryText);

				return res.status(200).json(result.rows);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		createUser: async (req, res) => {
			try {
				const { name, email } = req.body;

				const queryText = "INSERT INTO users (name, email) VALUES ($1, $2)";
				await db.query(queryText, [name, email]);

				return res.status(201).json({ name, email });
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
	};
};
