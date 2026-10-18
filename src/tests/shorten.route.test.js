const express = require("express");
const request = require("supertest");
const createShortenRouter = require("../routes/shorten.route");

function createApp(db) {
	const app = express();
	app.use(express.json());
	app.use(createShortenRouter(db));
	return app;
}

describe("Rotas de encurtamento de URL", () => {
	test("POST /createShorten salva uma URL válida e retorna o código", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app)
			.post("/createShorten")
			.send({ longURL: "https://google.com" });

		expect(response.status).toBe(201);
		expect(response.body.shortCode).toMatch(/^[a-f0-9]{8}$/);
		expect(db.query).toHaveBeenCalledWith(
			"INSERT INTO links (short_code, long_url) VALUES ($1, $2)",
			[response.body.shortCode, "https://google.com"],
		);
	});

	test("POST /createShorten rejeita uma URL inválida sem consultar o banco", async () => {
		const db = { query: jest.fn() };
		const app = createApp(db);

		const response = await request(app)
			.post("/createShorten")
			.send({ longURL: "url-invalida" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("GET /allShorten retorna os links do banco no formato da API", async () => {
		const createdAt = "2026-10-17T12:00:00.000Z";
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						short_code: "abcd1234",
						long_url: "https://google.com",
						clicks: 3,
						created_at: createdAt,
					},
				],
			}),
		};
		const app = createApp(db);

		const response = await request(app).get("/allShorten");

		expect(response.status).toBe(200);
		expect(response.body).toEqual([
			{
				id: 1,
				shortCode: "abcd1234",
				longURL: "https://google.com",
				clicks: 3,
				created_at: createdAt,
			},
		]);
		expect(db.query).toHaveBeenCalledWith(
			"SELECT * FROM links ORDER BY created_at DESC",
		);
	});

	test("GET /:shortCode incrementa os cliques e redireciona para a URL original", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({
					rows: [{ long_url: "https://google.com" }],
				})
				.mockResolvedValueOnce({ rows: [] }),
		};
		const app = createApp(db);

		const response = await request(app).get("/abcd1234");

		expect(response.status).toBe(302);
		expect(response.headers.location).toBe("https://google.com");
		expect(db.query).toHaveBeenNthCalledWith(
			1,
			"SELECT * FROM links WHERE short_code = $1",
			["abcd1234"],
		);
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			"UPDATE links SET clicks = clicks + 1 WHERE short_code = $1",
			["abcd1234"],
		);
	});

	test("GET /:shortCode retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).get("/inexistente");

		expect(response.status).toBe(404);
		expect(db.query).toHaveBeenCalledWith(
			"SELECT * FROM links WHERE short_code = $1",
			["inexistente"],
		);
	});

	test("GET /:shortCode/stats retorna as estatísticas do link", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						long_url: "https://google.com",
						clicks: 3,
					},
				],
			}),
		};
		const app = createApp(db);

		const response = await request(app).get("/abcd1234/stats");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			shortCode: "abcd1234",
			longURL: "https://google.com",
			clicks: 3,
		});
		expect(db.query).toHaveBeenCalledWith(
			"SELECT * FROM links WHERE short_code = $1",
			["abcd1234"],
		);
	});

	test("GET /:shortCode/stats retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).get("/inexistente/stats");

		expect(response.status).toBe(404);
	});

	test("DELETE /links/:shortCode/delete remove um link existente", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValue({ rows: [{ short_code: "abcd1234" }] }),
		};
		const app = createApp(db);

		const response = await request(app).delete("/links/abcd1234/delete");

		expect(response.status).toBe(200);
		expect(response.text).toBe("Registro deletado");
		expect(db.query).toHaveBeenCalledWith(
			"DELETE FROM links WHERE short_code = $1 RETURNING *",
			["abcd1234"],
		);
	});

	test("DELETE /links/:shortCode/delete retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).delete("/links/inexistente/delete");

		expect(response.status).toBe(404);
	});
});
