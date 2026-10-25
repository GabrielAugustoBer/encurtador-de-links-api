const express = require("express");
const request = require("supertest");
const createShortenRouter = require("../routes/shorten.route");

function createApp(
	db,
	authMiddleware = (_req, _res, next) => {
		_req.user = { id: 7 };
		next();
	},
	geoLocate = async () => null,
) {
	const app = express();
	app.use(express.json());
	app.use(createShortenRouter(db, authMiddleware, geoLocate));
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
		expect(response.body.shortCode).toMatch(/^[a-f0-9]{24}$/);
		expect(db.query).toHaveBeenCalledWith(
			"INSERT INTO links (short_code, long_url, user_id) VALUES ($1, $2, $3)",
			[response.body.shortCode, "https://google.com", 7],
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

	test("POST /createShorten rejeita esquemas que não sejam HTTP(S)", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.post("/createShorten")
			.send({ longURL: "javascript:alert(1)" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("POST /createShorten rejeita URLs com credenciais embutidas", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.post("/createShorten")
			.send({ longURL: "https://user:password@example.com/path" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("POST /createShorten rejeita um corpo JSON nulo", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.post("/createShorten")
			.set("Content-Type", "application/json")
			.send("null");

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
			expect.stringContaining(
				"FROM links WHERE user_id = $1 ORDER BY created_at DESC",
			),
			[7],
		);
	});

	test("GET /:shortCode incrementa os cliques e redireciona para a URL original", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({
					rows: [
						{
							id: 1,
							long_url: "https://google.com",
							is_active: true,
							expires_at: null,
						},
					],
				})
				.mockResolvedValueOnce({ rows: [{ long_url: "https://google.com" }] }),
		};
		const app = createApp(db, (_req, res) =>
			res.status(401).json({ error: "Autenticação necessária" }),
		);

		const response = await request(app).get("/abcd1234");

		expect(response.status).toBe(302);
		expect(response.headers.location).toBe("https://google.com");
		expect(db.query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("FROM links WHERE short_code = $1"),
			["abcd1234"],
		);
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("INSERT INTO click_events"),
			["abcd1234", null],
		);
	});

	test("GET /:shortCode retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).get("/inexistente");

		expect(response.status).toBe(404);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("FROM links WHERE short_code = $1"),
			["inexistente"],
		);
	});

	test("GET /:shortCode retorna 410 para link desativado", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						long_url: "https://google.com",
						is_active: false,
						expires_at: null,
					},
				],
			}),
		};
		const response = await request(createApp(db)).get("/abcd1234");

		expect(response.status).toBe(410);
		expect(db.query).toHaveBeenCalledTimes(1);
	});

	test("GET /:shortCode retorna 410 para link expirado", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						long_url: "https://google.com",
						is_active: true,
						expires_at: "2020-01-01T00:00:00.000Z",
					},
				],
			}),
		};
		const response = await request(createApp(db)).get("/abcd1234");

		expect(response.status).toBe(410);
		expect(db.query).toHaveBeenCalledTimes(1);
	});

	test("GET /:shortCode registra país sem persistir o IP", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({
					rows: [
						{
							id: 1,
							long_url: "https://google.com",
							is_active: true,
							expires_at: null,
						},
					],
				})
				.mockResolvedValueOnce({ rows: [{ long_url: "https://google.com" }] }),
		};
		const geoLocate = jest.fn().mockResolvedValue("BR");
		const response = await request(createApp(db, undefined, geoLocate)).get(
			"/abcd1234",
		);

		expect(response.status).toBe(302);
		expect(geoLocate).toHaveBeenCalledWith("127.0.0.1");
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("INSERT INTO click_events"),
			["abcd1234", "BR"],
		);
		expect(JSON.stringify(db.query.mock.calls)).not.toContain("127.0.0.1");
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
			expect.stringContaining(
				"FROM links WHERE short_code = $1 AND user_id = $2",
			),
			["abcd1234", 7],
		);
	});

	test("GET /:shortCode/stats retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).get("/inexistente/stats");

		expect(response.status).toBe(404);
	});

	test("GET /links/:shortCode retorna somente um link do proprietário", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						short_code: "abcd1234",
						long_url: "https://google.com",
						clicks: 3,
						created_at: "2026-10-17T12:00:00.000Z",
					},
				],
			}),
		};
		const response = await request(createApp(db)).get("/links/abcd1234");

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			id: 1,
			shortCode: "abcd1234",
			longURL: "https://google.com",
			clicks: 3,
			created_at: "2026-10-17T12:00:00.000Z",
		});
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining(
				"FROM links WHERE short_code = $1 AND user_id = $2",
			),
			["abcd1234", 7],
		);
	});

	test("GET /links/:shortCode oculta links pertencentes a outro usuário", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db)).get("/links/privado");

		expect(response.status).toBe(404);
		expect(response.body).toEqual({ error: "Link não encontrado" });
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining(
				"FROM links WHERE short_code = $1 AND user_id = $2",
			),
			["privado", 7],
		);
	});

	test("PATCH /links/:shortCode atualiza apenas o link do proprietário", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						short_code: "abcd1234",
						long_url: "https://example.com",
						clicks: 3,
						created_at: "2026-10-17T12:00:00.000Z",
					},
				],
			}),
		};
		const response = await request(createApp(db))
			.patch("/links/abcd1234")
			.send({ longURL: "https://example.com" });

		expect(response.status).toBe(200);
		expect(response.body.longURL).toBe("https://example.com");
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("WHERE short_code = $2 AND user_id = $3"),
			["https://example.com", "abcd1234", 7],
		);
	});

	test("PATCH /links/:shortCode não atualiza link de outro usuário", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db))
			.patch("/links/privado")
			.send({ longURL: "https://example.com" });

		expect(response.status).toBe(404);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("WHERE short_code = $2 AND user_id = $3"),
			["https://example.com", "privado", 7],
		);
	});

	test("PATCH /links/:shortCode rejeita URLs não HTTP sem consultar o banco", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.patch("/links/abcd1234")
			.send({ longURL: "javascript:alert(1)" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("PATCH /links/:shortCode/settings configura expiração e estado", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [
					{
						id: 1,
						short_code: "abcd1234",
						long_url: "https://example.com",
						clicks: 0,
						created_at: "2026-10-17T12:00:00.000Z",
						is_active: false,
						expires_at: "2027-01-01T00:00:00.000Z",
					},
				],
			}),
		};
		const response = await request(createApp(db))
			.patch("/links/abcd1234/settings")
			.send({
				expiresAt: "2027-01-01T00:00:00.000Z",
				isActive: false,
			});

		expect(response.status).toBe(200);
		expect(response.body.isActive).toBe(false);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("SET expires_at = CASE WHEN $1 THEN $2"),
			[true, new Date("2027-01-01T00:00:00.000Z"), true, false, "abcd1234", 7],
		);
	});

	test("PATCH /links/:shortCode/settings rejeita expiração não futura", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.patch("/links/abcd1234/settings")
			.send({ expiresAt: "2000-01-01T00:00:00.000Z" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("PATCH /links/:shortCode/settings recusa parâmetros extras", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.patch("/links/abcd1234/settings")
			.send({ role: "admin" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("POST /links/:shortCode/disable e enable alternam o link do proprietário", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 1 }] })
				.mockResolvedValueOnce({ rows: [{ id: 1 }] }),
		};

		const disable = await request(createApp(db)).post(
			"/links/abcd1234/disable",
		);
		const enable = await request(createApp(db)).post("/links/abcd1234/enable");

		expect(disable.status).toBe(200);
		expect(disable.body).toEqual({ active: false });
		expect(enable.status).toBe(200);
		expect(enable.body).toEqual({ active: true });
		expect(db.query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("SET is_active = $1"),
			[false, "abcd1234", 7],
		);
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("SET is_active = $1"),
			[true, "abcd1234", 7],
		);
	});

	test("GET /links/:shortCode/analytics retorna métricas apenas do proprietário", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 1 }] })
				.mockResolvedValueOnce({
					rows: [{ clicks: 12, active_days: 3 }],
				}),
		};
		const response = await request(createApp(db)).get(
			"/links/abcd1234/analytics?from=2026-10-01&to=2026-10-25",
		);

		expect(response.status).toBe(200);
		expect(response.body).toEqual({
			from: "2026-10-01",
			to: "2026-10-25",
			clicks: 12,
			active_days: 3,
		});
		expect(db.query).toHaveBeenNthCalledWith(
			1,
			expect.stringContaining("user_id = $2"),
			["abcd1234", 7],
		);
		expect(db.query).toHaveBeenNthCalledWith(
			2,
			expect.stringContaining("COUNT(events.id)"),
			["abcd1234", 7, "2026-10-01", "2026-10-25"],
		);
	});

	test("GET analytics oculta links de outra conta e não consulta métricas", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db)).get(
			"/links/privado/analytics",
		);

		expect(response.status).toBe(404);
		expect(db.query).toHaveBeenCalledTimes(1);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("user_id = $2"),
			["privado", 7],
		);
	});

	test("GET /links/:shortCode/analytics/countries agrega países", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 1 }] })
				.mockResolvedValueOnce({
					rows: [
						{ country: "BR", clicks: 4 },
						{ country: "unknown", clicks: 1 },
					],
				}),
		};
		const response = await request(createApp(db)).get(
			"/links/abcd1234/analytics/countries?from=2026-10-01&to=2026-10-02",
		);

		expect(response.status).toBe(200);
		expect(response.body.countries).toEqual([
			{ country: "BR", clicks: 4 },
			{ country: "unknown", clicks: 1 },
		]);
	});

	test("GET country analytics retorna lista vazia sem cliques no período", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 1 }] })
				.mockResolvedValueOnce({ rows: [] }),
		};
		const response = await request(createApp(db)).get(
			"/links/abcd1234/analytics/countries?from=2026-10-01&to=2026-10-02",
		);

		expect(response.status).toBe(200);
		expect(response.body.countries).toEqual([]);
	});

	test("GET /links/:shortCode/analytics/timeseries preenche dias sem cliques", async () => {
		const db = {
			query: jest
				.fn()
				.mockResolvedValueOnce({ rows: [{ id: 1 }] })
				.mockResolvedValueOnce({
					rows: [{ date: "2026-10-01", clicks: 2 }],
				}),
		};
		const response = await request(createApp(db)).get(
			"/links/abcd1234/analytics/timeseries?from=2026-10-01&to=2026-10-03",
		);

		expect(response.status).toBe(200);
		expect(response.body.series).toEqual([
			{ date: "2026-10-01", clicks: 2 },
			{ date: "2026-10-02", clicks: 0 },
			{ date: "2026-10-03", clicks: 0 },
		]);
	});

	test("GET analytics rejeita período inválido sem consultar o banco", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db)).get(
			"/links/abcd1234/analytics?from=not-a-date",
		);

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("GET analytics exige autenticação", async () => {
		const db = { query: jest.fn() };
		const response = await request(
			createApp(db, (_req, res) =>
				res.status(401).json({ error: "Autenticação necessária" }),
			),
		).get("/links/abcd1234/analytics");

		expect(response.status).toBe(401);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("DELETE /links/:shortCode exige autenticação", async () => {
		const db = { query: jest.fn() };
		const response = await request(
			createApp(db, (_req, res) =>
				res.status(401).json({ error: "Autenticação necessária" }),
			),
		).delete("/links/abcd1234");

		expect(response.status).toBe(401);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("DELETE /links/:shortCode não apaga links de outro usuário", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db)).delete("/links/privado");

		expect(response.status).toBe(404);
		expect(db.query).toHaveBeenCalledWith(
			"DELETE FROM links WHERE short_code = $1 AND user_id = $2 RETURNING *",
			["privado", 7],
		);
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
			"DELETE FROM links WHERE short_code = $1 AND user_id = $2 RETURNING *",
			["abcd1234", 7],
		);
	});

	test("DELETE /links/:shortCode/delete retorna 404 quando o código não existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const app = createApp(db);

		const response = await request(app).delete("/links/inexistente/delete");

		expect(response.status).toBe(404);
	});

	test("POST /createShorten exige autenticação", async () => {
		const db = { query: jest.fn() };
		const app = createApp(db, (_req, res) =>
			res.status(401).json({ error: "Autenticação necessária" }),
		);

		const response = await request(app)
			.post("/createShorten")
			.send({ longURL: "https://google.com" });

		expect(response.status).toBe(401);
		expect(db.query).not.toHaveBeenCalled();
	});
});
