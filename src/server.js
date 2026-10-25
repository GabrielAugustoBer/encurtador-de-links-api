const express = require("express");
const helmet = require("helmet");
const { Pool } = require("pg");
const createAuthRepository = require("./repositories/auth.repository");
const createAuthMiddleware = require("./middlewares/auth.middleware");
const createUsersRouter = require("./routes/users.route");
const createShortenRouter = require("./routes/shorten.route");
const createGeoIpService = require("./services/geoip.service");
require("dotenv").config();
const app = express();

app.set("json spaces", 2);
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
const trustedProxyHops = process.env.TRUSTED_PROXY_HOPS ?? "0";
if (!/^\d+$/.test(trustedProxyHops) || Number(trustedProxyHops) > 20) {
	throw new Error("TRUSTED_PROXY_HOPS deve ser um inteiro entre 0 e 20");
}
app.set("trust proxy", Number(trustedProxyHops));

const connectionString =
	process.env.NODE_ENV === "test"
		? process.env.DATABASE_URL_TEST
		: process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error(
		process.env.NODE_ENV === "test"
			? "DATABASE_URL_TEST é obrigatória em modo de teste"
			: "DATABASE_URL é obrigatória",
	);
}

const db = new Pool({
	connectionString,
	connectionTimeoutMillis: 5000,
	idleTimeoutMillis: 30_000,
	max: 10,
	ssl: { rejectUnauthorized: true },
});

const authMiddleware = createAuthMiddleware(
	createAuthRepository(db),
	process.env.JWT_SECRET,
);

const ready = createGeoIpService(process.env.GEOIP_DATABASE_PATH)
	.then((geoLocate) => {
		app.use(
			createUsersRouter(db, {
				jwtSecret: process.env.JWT_SECRET,
				authMiddleware,
			}),
		);
		app.use(createShortenRouter(db, authMiddleware, geoLocate));
		app.get("/", (_req, res) => {
			res.send("Servidor rodando com sucesso!");
		});
		app.use((_req, res) => {
			res.status(404).json({ error: "Rota não encontrada" });
		});
		app.use((error, _req, res, next) => {
			if (res.headersSent) {
				return next(error);
			}
			const statusCode =
				Number.isInteger(error.status) &&
				error.status >= 400 &&
				error.status < 500
					? error.status
					: 500;
			if (statusCode === 500) {
				console.error(error);
			}
			return res.status(statusCode).json({
				error: statusCode === 500 ? "Erro interno no servidor" : error.message,
			});
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
		return app;
	})
	.catch((error) => {
		console.error("Falha ao inicializar geolocalização:", error.message);
		process.exitCode = 1;
	});

module.exports = { app, db, ready };

/*
GET: recupera dados de um recurso especificado.
POST: envia novos dados para um recurso.
PUT: atualiza um recurso atual com novos dados.
DELETE: remove um recurso especificado.
*/
