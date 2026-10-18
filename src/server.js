const express = require("express");
const { Pool } = require("pg");
const createUsersRouter = require("./routes/users.route");
const createShortenRouter = require("./routes/shorten.route");
const _env = require("dotenv").config();
//const cors = require("cors");
const app = express();

app.set("json spaces", 2);
app.use(express.json());

let db;

if (process.env.NODE_ENV === "test") {
	db = new Pool({
		connectionString: process.env.DATABASE_URL_TEST,
		ssl: {
			rejectUnauthorized: false,
		},
	});
} else {
	db = new Pool({
		connectionString: process.env.DATABASE_URL,
		ssl: {
			rejectUnauthorized: false,
		},
	});
}

app.use(createUsersRouter(db));
app.use(createShortenRouter(db));

app.get("/", (_req, res) => {
	res.send("Servidor rodando com sucesso!");
});

if (process.env.NODE_ENV === "test") {
	const PORT = process.env.PORT_TEST;
	console.log(`Modo de teste rodando em http://localhost:${PORT}`);
} else {
	const PORT = process.env.PORT;
	app.listen(PORT, () => {
		console.log(`Servidor rodando em http://localhost:${PORT}`);
	});
}

module.exports = { app, db };

/*
GET: recupera dados de um recurso especificado.
POST: envia novos dados para um recurso.
PUT: atualiza um recurso atual com novos dados.
DELETE: remove um recurso especificado.
*/
