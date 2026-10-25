const bcrypt = require("bcryptjs");
const createAuthService = require("../services/auth.services");
const express = require("express");
const jwt = require("jsonwebtoken");
const request = require("supertest");
const createUsersRouter = require("../routes/users.route");
const createAuthMiddleware = require("../middlewares/auth.middleware");

const JWT_SECRET = "test-secret-with-at-least-32-bytes";
const user = { id: 1, name: "Ana", email: "ana@example.com", role: "user" };

function createApp(db, role = "admin") {
	const app = express();
	app.use(express.json());
	app.use(
		createUsersRouter(db, {
			jwtSecret: JWT_SECRET,
			authMiddleware: (req, _res, next) => {
				req.user = { ...user, role };
				req.auth = {
					tokenId: "b1f24c47-7a44-4d95-bafe-39b3dc0f4321",
					expiresAt: 1_900_000_000,
				};
				next();
			},
		}),
	);
	return app;
}

describe("Rotas de usuários e autenticação", () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("POST /createUser salva apenas o hash e retorna dados públicos", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [user] }) };
		const app = createApp(db);
		const password = "Senha-segura-123";

		const response = await request(app).post("/createUser").send({
			name: " Ana ",
			email: " ANA@EXAMPLE.COM ",
			senha: password,
		});

		expect(response.status).toBe(201);
		expect(response.body).toEqual(user);
		expect(db.query).toHaveBeenCalledWith(
			"INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role",
			["Ana", "ana@example.com", expect.any(String)],
		);
		const [, , passwordHash] = db.query.mock.calls[0][1];
		expect(passwordHash).not.toBe(password);
		expect(await bcrypt.compare(password, passwordHash)).toBe(true);
	});

	test("POST /createUser rejeita senha curta sem consultar o banco", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db))
			.post("/createUser")
			.send({ name: "Ana", email: "ana@example.com", senha: "curta" });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("POST /login retorna token com identidade não sensível", async () => {
		const password = "Senha-segura-123";
		const passwordHash = await bcrypt.hash(password, 4);
		const db = {
			query: jest.fn().mockResolvedValue({
				rows: [{ ...user, password_hash: passwordHash }],
			}),
		};

		const response = await request(createApp(db))
			.post("/login")
			.send({ email: " ANA@EXAMPLE.COM ", senha: password });

		expect(response.status).toBe(200);
		expect(response.body.user).toEqual(user);
		expect(response.body).not.toHaveProperty("password_hash");
		const payload = jwt.verify(response.body.token, JWT_SECRET, {
			algorithms: ["HS256"],
			audience: "encurtador-de-links-api",
			issuer: "encurtador-de-links-api",
		});
		expect(payload.sub).toBe("1");
		expect(payload.jti).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);
		expect(db.query).toHaveBeenCalledWith(
			"SELECT id, name, email, role, password_hash FROM users WHERE LOWER(email) = $1",
			["ana@example.com"],
		);
	});

	test("POST /login não revela se o e-mail existe", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db))
			.post("/login")
			.send({ email: "missing@example.com", senha: "Senha-segura-123" });

		expect(response.status).toBe(401);
		expect(response.body).toEqual({ error: "E-mail ou senha inválidos" });
	});

	test("POST /login compara senha mesmo quando o e-mail não existe", async () => {
		const compare = jest.spyOn(bcrypt, "compare").mockResolvedValue(false);
		const usersRepository = {
			findByEmail: jest.fn().mockResolvedValue(null),
		};
		const service = createAuthService(
			usersRepository,
			{ revokeToken: jest.fn() },
			JWT_SECRET,
		);

		await expect(
			service.login("missing@example.com", "Senha-segura-123"),
		).rejects.toMatchObject({
			statusCode: 401,
			message: "E-mail ou senha inválidos",
		});
		expect(compare).toHaveBeenCalledWith(
			"Senha-segura-123",
			expect.stringMatching(/^\$2[aby]\$/),
		);
		compare.mockRestore();
	});

	test("POST /logout revoga o identificador do token até sua expiração", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [] }) };
		const response = await request(createApp(db))
			.post("/logout")
			.set("Authorization", "Bearer token");

		expect(response.status).toBe(200);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("INSERT INTO revoked_tokens"),
			["b1f24c47-7a44-4d95-bafe-39b3dc0f4321", new Date(1_900_000_000 * 1000)],
		);
	});

	test("GET /all-users exige papel de administrador", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db, "user")).get("/all-users");

		expect(response.status).toBe(403);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("GET /all-users retorna apenas campos não sensíveis", async () => {
		const db = { query: jest.fn().mockResolvedValue({ rows: [user] }) };
		const response = await request(createApp(db)).get("/all-users");

		expect(response.status).toBe(200);
		expect(response.body).toEqual([user]);
		expect(db.query).toHaveBeenCalledWith(
			"SELECT id, name, email, role FROM users ORDER BY id",
		);
	});

	test("GET /me retorna apenas os dados públicos da sessão", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db, "user")).get("/me");

		expect(response.status).toBe(200);
		expect(response.body).toEqual(user);
		expect(response.body).not.toHaveProperty("password_hash");
		expect(db.query).not.toHaveBeenCalled();
	});

	test("PATCH /me rejeita campos fora da lista permitida", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db, "user")).patch("/me").send({
			name: "Ana Maria",
			email: "ANA.MARIA@example.com",
			role: "admin",
		});

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("PATCH /me atualiza somente campos permitidos e normaliza o e-mail", async () => {
		const updatedUser = {
			id: 1,
			name: "Ana Maria",
			email: "ana.maria@example.com",
			role: "user",
		};
		const db = { query: jest.fn().mockResolvedValue({ rows: [updatedUser] }) };
		const response = await request(createApp(db, "user"))
			.patch("/me")
			.send({ name: "Ana Maria", email: "ANA.MARIA@example.com" });

		expect(response.status).toBe(200);
		expect(response.body).toEqual(updatedUser);
		expect(db.query).toHaveBeenCalledWith(
			expect.stringContaining("UPDATE users"),
			["Ana Maria", "ana.maria@example.com", 1],
		);
	});

	test("PATCH /me rejeita dados inválidos sem consultar o banco", async () => {
		const db = { query: jest.fn() };
		const response = await request(createApp(db, "user"))
			.patch("/me")
			.send({ name: "   " });

		expect(response.status).toBe(400);
		expect(db.query).not.toHaveBeenCalled();
	});

	test("GET /me exige autenticação", async () => {
		const db = { query: jest.fn() };
		const app = express();
		app.use(express.json());
		app.use(
			createUsersRouter(db, {
				jwtSecret: JWT_SECRET,
				authMiddleware: createAuthMiddleware(
					{ authenticate: jest.fn() },
					JWT_SECRET,
				),
			}),
		);
		const response = await request(app).get("/me");

		expect(response.status).toBe(401);
		expect(db.query).not.toHaveBeenCalled();
	});
});
