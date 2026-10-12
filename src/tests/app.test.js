const request = require("supertest");
const { app, db } = require("../server");

describe("POST /shorten", () => {
	test("Deve retornar status 201 ao enviar uma URL válida", async () => {
		const response = await request(app)
			.post("/shorten")
			.send({ longURL: "https://google.com" });

		expect(response.status).toBe(201);
		expect(response.body).toHaveProperty("shortCode");
	});
	test("Deve retornar status 400 ao enviar uma URL inválida", async () => {
		const response = await request(app)
			.post("/shorten")
			.send({ longURL: "google.com" });

		expect(response.status).toBe(400);
	});
});

describe("GET /:shortCode/stats", () => {
	test("Deve retornar status 200 e as estatísticas do link recém-criado", async () => {
		// 1. Cria o link dinamicamente
		const createResponse = await request(app)
			.post("/shorten")
			.send({ longURL: "https://google.com" });

		const createdCode = createResponse.body.shortCode;

		const statsResponse = await request(app).get(`/${createdCode}/stats`);

		expect(statsResponse.status).toBe(200);
		expect(statsResponse.body.shortCode).toBe(createdCode);
		expect(statsResponse.body).toHaveProperty("longURL");
		expect(statsResponse.body).toHaveProperty("clicks");
	});
	test("Deve retornar status 404 ao enviar um shortCode invalído", async () => {
		const response = await request(app).get("/codigo-inexistente/stats");

		expect(response.status).toBe(404);
	});
});

afterAll(async () => {
	await db.end();
});
