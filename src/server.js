const express = require("express");
const { Pool } = require("pg");
const crypto = require("node:crypto");
require("dotenv").config();

const app = express();
app.use(express.json());

const db = new Pool({
	connectionString: process.env.DATABASE_URL,
	ssl: {
		rejectUnauthorized: false,
	},
});

// 1. Rota de teste inicial

app.get("/", (_req, res) => {
	res.send("Servidor rodando com sucesso!");
});

// 2. Rota para encurtar URL
app.post("/shorten", async (req, res) => {
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
});

// 3. Rota para redirecionar para a URL original
app.get("/:shortCode", async (req, res) => {
	try {
		const { shortCode } = req.params;

		const queryText = "SELECT * FROM links WHERE short_code = $1";
		const result = await db.query(queryText, [shortCode]);

		if (result.rows[0]) {
			//atualiza coluna clicks
			const queryText =
				"UPDATE links SET clicks = clicks + 1 WHERE short_code = $1";
			await db.query(queryText, [shortCode]);

			return res.redirect(result.rows[0].long_url);
		} else {
			return res.status(404).send("Link não encontrado");
		}
	} catch (error) {
		console.error(error);
		return res.status(500).send("Erro interno no servidor");
	}
});

// 4. Inicialização do servidor
const PORT = process.env.PORT;
app.listen(PORT, () => {
	console.log(`Servidor rodando em http://localhost:${PORT}`);
});
