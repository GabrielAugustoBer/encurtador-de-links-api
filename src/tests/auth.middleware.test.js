const jwt = require("jsonwebtoken");
const createAuthMiddleware = require("../middlewares/auth.middleware");

const JWT_SECRET = "test-secret-with-at-least-32-bytes";
const user = { id: 1, name: "Ana", email: "ana@example.com", role: "user" };

function createToken(secret = JWT_SECRET) {
	return jwt.sign({}, secret, {
		algorithm: "HS256",
		audience: "encurtador-de-links-api",
		expiresIn: "15m",
		issuer: "encurtador-de-links-api",
		jwtid: "b1f24c47-7a44-4d95-bafe-39b3dc0f4321",
		subject: "1",
	});
}

function createResponse() {
	return {
		status: jest.fn().mockReturnThis(),
		json: jest.fn().mockReturnThis(),
	};
}

describe("Middleware de autenticação", () => {
	test("rejeita requisições sem token", async () => {
		const authRepository = { authenticate: jest.fn() };
		const middleware = createAuthMiddleware(authRepository, JWT_SECRET);
		const req = { get: () => undefined };
		const res = createResponse();
		const next = jest.fn();

		await middleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(authRepository.authenticate).not.toHaveBeenCalled();
		expect(next).not.toHaveBeenCalled();
	});

	test("anexa usuário do banco apenas após verificar um token válido", async () => {
		const authRepository = {
			authenticate: jest.fn().mockResolvedValue(user),
		};
		const middleware = createAuthMiddleware(authRepository, JWT_SECRET);
		const req = { get: () => `Bearer ${createToken()}` };
		const res = createResponse();
		const next = jest.fn();

		await middleware(req, res, next);

		expect(authRepository.authenticate).toHaveBeenCalledWith(
			"1",
			"b1f24c47-7a44-4d95-bafe-39b3dc0f4321",
		);
		expect(req.user).toEqual(user);
		expect(req.auth.tokenId).toBe("b1f24c47-7a44-4d95-bafe-39b3dc0f4321");
		expect(next).toHaveBeenCalledTimes(1);
	});

	test("rejeita tokens revogados", async () => {
		const authRepository = {
			authenticate: jest.fn().mockResolvedValue(null),
		};
		const middleware = createAuthMiddleware(authRepository, JWT_SECRET);
		const req = { get: () => `Bearer ${createToken()}` };
		const res = createResponse();

		await middleware(req, res, jest.fn());

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({
			error: "Token inválido ou revogado",
		});
	});

	test("exige segredo com ao menos 32 bytes", () => {
		expect(() =>
			createAuthMiddleware({ authenticate: jest.fn() }, "short"),
		).toThrow("JWT_SECRET deve ter pelo menos 32 bytes");
	});
});
