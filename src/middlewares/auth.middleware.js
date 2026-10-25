const jwt = require("jsonwebtoken");

const JWT_ISSUER = "encurtador-de-links-api";
const JWT_AUDIENCE = "encurtador-de-links-api";

module.exports = function createAuthMiddleware(authRepository, secret) {
	if (typeof secret !== "string" || Buffer.byteLength(secret, "utf8") < 32) {
		throw new Error("JWT_SECRET deve ter pelo menos 32 bytes");
	}

	return async (req, res, next) => {
		const authorization = req.get("authorization");
		const match =
			typeof authorization === "string" &&
			/^Bearer ([^\s]+)$/i.exec(authorization);
		if (!match) {
			return res.status(401).json({ error: "Autenticação necessária" });
		}

		let payload;
		try {
			payload = jwt.verify(match[1], secret, {
				algorithms: ["HS256"],
				audience: JWT_AUDIENCE,
				issuer: JWT_ISSUER,
			});
		} catch {
			return res.status(401).json({ error: "Token inválido ou expirado" });
		}

		if (
			typeof payload !== "object" ||
			typeof payload.sub !== "string" ||
			typeof payload.jti !== "string" ||
			typeof payload.exp !== "number"
		) {
			return res.status(401).json({ error: "Token inválido ou expirado" });
		}

		try {
			const user = await authRepository.authenticate(payload.sub, payload.jti);
			if (!user) {
				return res.status(401).json({ error: "Token inválido ou revogado" });
			}

			req.user = user;
			req.auth = { tokenId: payload.jti, expiresAt: payload.exp };
			return next();
		} catch (error) {
			console.error(error);
			return res.status(500).json({ error: "Erro interno no servidor" });
		}
	};
};
