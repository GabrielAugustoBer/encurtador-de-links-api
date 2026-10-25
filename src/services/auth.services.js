const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const AppError = require("../errors/app-error");

const JWT_ISSUER = "encurtador-de-links-api";
const JWT_AUDIENCE = "encurtador-de-links-api";
const DUMMY_PASSWORD_HASH = bcrypt.hash(
	crypto.randomBytes(32).toString("hex"),
	12,
);

module.exports = function createAuthService(
	usersRepository,
	authRepository,
	secret,
) {
	return {
		login: async (email, senha) => {
			if (
				typeof email !== "string" ||
				typeof senha !== "string" ||
				email.trim().length === 0 ||
				senha.length === 0
			) {
				throw new AppError(400, "E-mail e senha são obrigatórios");
			}

			const user = await usersRepository.findByEmail(
				email.trim().toLowerCase(),
			);
			const passwordHash = user?.password_hash ?? (await DUMMY_PASSWORD_HASH);
			const passwordMatches = await bcrypt.compare(senha, passwordHash);
			if (!user || !passwordMatches) {
				throw new AppError(401, "E-mail ou senha inválidos");
			}

			const token = jwt.sign({}, secret, {
				algorithm: "HS256",
				audience: JWT_AUDIENCE,
				expiresIn: "15m",
				issuer: JWT_ISSUER,
				jwtid: crypto.randomUUID(),
				subject: String(user.id),
			});

			return {
				token,
				user: {
					id: user.id,
					name: user.name,
					email: user.email,
					role: user.role,
				},
			};
		},
		logout: (tokenId, expiresAt) =>
			authRepository.revokeToken(tokenId, new Date(expiresAt * 1000)),
	};
};
