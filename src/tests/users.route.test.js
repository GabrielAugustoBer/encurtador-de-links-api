const express = require("express");
const request = require("supertest");
const createUsersRouter = require("../routes/users.route");

describe("Rotas de usuários", () => {
	test("POST /createUser salva e retorna o usuário criado", async () => {
		const db = {
			query: jest.fn().mockResolvedValue({ rows: [] }),
		};
		const app = express();
		app.use(express.json());
		app.use(createUsersRouter(db));

		const response = await request(app)
			.post("/createUser")
			.send({ name: "Ana", email: "ana@example.com" });

		expect(response.status).toBe(201);
		expect(response.body).toEqual({ name: "Ana", email: "ana@example.com" });
		expect(db.query).toHaveBeenCalledWith(
			"INSERT INTO users (name, email) VALUES ($1, $2)",
			["Ana", "ana@example.com"],
		);
	});

	test("GET /all-users retorna os usuários do banco", async () => {
		const users = [{ id: 1, name: "Ana", email: "ana@example.com" }];
		const db = {
			query: jest.fn().mockResolvedValue({ rows: users }),
		};
		const app = express();
		app.use(createUsersRouter(db));

		const response = await request(app).get("/all-users");

		expect(response.status).toBe(200);
		expect(response.body).toEqual(users);
	});
});
