const express = require("express");
const request = require("supertest");
const createCorsMiddleware = require("../middlewares/cors.middleware");

function createApp(origins) {
	const app = express();
	app.use(createCorsMiddleware(origins));
	app.get("/resource", (_req, res) => res.json({ ok: true }));
	return app;
}

describe("Middleware CORS", () => {
	test("permite uma origem configurada", async () => {
		const response = await request(
			createApp("https://app.example.com,http://localhost:5173"),
		)
			.get("/resource")
			.set("Origin", "https://app.example.com");

		expect(response.status).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"https://app.example.com",
		);
		expect(response.headers.vary).toContain("Origin");
	});

	test("responde preflight apenas para método e cabeçalhos permitidos", async () => {
		const response = await request(createApp("https://app.example.com"))
			.options("/resource")
			.set("Origin", "https://app.example.com")
			.set("Access-Control-Request-Method", "PATCH")
			.set("Access-Control-Request-Headers", "authorization,content-type");

		expect(response.status).toBe(204);
		expect(response.headers["access-control-allow-origin"]).toBe(
			"https://app.example.com",
		);
		expect(response.headers["access-control-allow-methods"]).toContain("PATCH");
		expect(response.headers["access-control-allow-headers"]).toBe(
			"Authorization,Content-Type",
		);
	});

	test("não autoriza origens desconhecidas nem métodos/cabeçalhos não permitidos", async () => {
		const app = createApp("https://app.example.com");
		const deniedOrigin = await request(app)
			.options("/resource")
			.set("Origin", "https://attacker.example")
			.set("Access-Control-Request-Method", "POST");
		const deniedMethod = await request(app)
			.options("/resource")
			.set("Origin", "https://app.example.com")
			.set("Access-Control-Request-Method", "PUT");
		const deniedHeader = await request(app)
			.options("/resource")
			.set("Origin", "https://app.example.com")
			.set("Access-Control-Request-Method", "POST")
			.set("Access-Control-Request-Headers", "x-unapproved");

		expect(deniedOrigin.status).toBe(403);
		expect(deniedOrigin.headers["access-control-allow-origin"]).toBeUndefined();
		expect(deniedMethod.status).toBe(403);
		expect(deniedHeader.status).toBe(403);
	});

	test("rejeita wildcard, URLs com path e protocolos não HTTP(S)", () => {
		expect(() => createCorsMiddleware("*")).toThrow(
			"Origem inválida em FRONTEND_ORIGINS",
		);
		expect(() =>
			createCorsMiddleware("https://app.example.com/dashboard"),
		).toThrow("Origem inválida em FRONTEND_ORIGINS");
		expect(() => createCorsMiddleware("ftp://app.example.com")).toThrow(
			"Origem inválida em FRONTEND_ORIGINS",
		);
	});
});
