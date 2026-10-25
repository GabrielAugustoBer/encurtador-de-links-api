const express = require("express");
const request = require("supertest");
const createAuthRateLimit = require("../middlewares/auth-rate-limit.middleware");

describe("Limite de tentativas de autenticação", () => {
	test("retorna 429 após atingir o limite por IP", async () => {
		const app = express();
		app.post(
			"/login",
			createAuthRateLimit({ limit: 1, windowMs: 60_000 }),
			(_req, res) => res.status(200).json({ ok: true }),
		);

		const firstAttempt = await request(app).post("/login");
		const secondAttempt = await request(app).post("/login");

		expect(firstAttempt.status).toBe(200);
		expect(secondAttempt.status).toBe(429);
		expect(secondAttempt.body).toEqual({
			error: "Muitas tentativas. Tente novamente depois.",
		});
		expect(secondAttempt.headers["ratelimit-limit"]).toBe("1");
	});
});
