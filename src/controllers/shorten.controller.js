module.exports = function shortenController(db) {
	const crypto = require("node:crypto");

	return {
		allShorten: async (_req, res) => {
			try {
				const queryText = "SELECT * FROM links ORDER BY created_at DESC";
				const result = await db.query(queryText);

				return res.status(200).json(
					result.rows.map(row => ({
						id: row.id,
						shortCode: row.short_code,
						longURL: row.long_url,
						clicks: row.clicks,
						created_at: row.created_at,
					})),
				);
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		createShorten: async (req, res) => {
			try {
				const { longURL } = req.body;
				const shortCode = crypto.randomBytes(4).toString("hex");

				if (URL.canParse(longURL) === true) {
					const queryText =
						"INSERT INTO links (short_code, long_url) VALUES ($1, $2)";
					await db.query(queryText, [shortCode, longURL]);

					return res.status(201).json({ shortCode });
				} else {
					return res.status(400).send("O URL não é valido");
				}
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		redirectShort: async (req, res) => {
			try {
				const { shortCode } = req.params;

				const queryText = "SELECT * FROM links WHERE short_code = $1";
				const result = await db.query(queryText, [shortCode]);

				if (result.rows[0]) {
					const queryText =
						"UPDATE links SET clicks = clicks + 1 WHERE short_code = $1";
					await db.query(queryText, [shortCode]);

					return res.status(302).redirect(result.rows[0].long_url);
				} else {
					return res.status(404).send("Link não encontrado");
				}
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		statsShort: async (req, res) => {
			try {
				const { shortCode } = req.params;

				const queryText = "SELECT * FROM links WHERE short_code = $1";
				const result = await db.query(queryText, [shortCode]);

				if (result.rows[0]) {
					return res.status(200).json({
						shortCode,
						longURL: result.rows[0].long_url,
						clicks: result.rows[0].clicks,
					});
				} else {
					return res.status(404).send("Link não encontrado");
				}
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
		deleteShort: async (req, res) => {
			try {
				const { shortCode } = req.params;

				const queryText = "DELETE FROM links WHERE short_code = $1 RETURNING *";
				const result = await db.query(queryText, [shortCode]);

				if (result.rows[0]) {
					return res.status(200).send("Registro deletado");
				} else {
					return res.status(404).send("Link não encontrado");
				}
			} catch (error) {
				console.error(error);
				return res.status(500).send("Erro interno no servidor");
			}
		},
	};
};
