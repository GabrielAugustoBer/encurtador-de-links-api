const ALLOWED_METHODS = new Set(["GET", "POST", "PATCH", "DELETE"]);
const ALLOWED_HEADERS = new Set(["authorization", "content-type"]);
const ALLOW_METHODS_HEADER = "GET,POST,PATCH,DELETE,OPTIONS";
const ALLOW_HEADERS_HEADER = "Authorization,Content-Type";

function parseAllowedOrigins(value = "") {
	const origins = value
		.split(",")
		.map((origin) => origin.trim())
		.filter(Boolean);

	for (const origin of origins) {
		let parsed;
		try {
			parsed = new URL(origin);
		} catch {
			throw new Error(`Origem inválida em FRONTEND_ORIGINS: ${origin}`);
		}

		if (
			!["http:", "https:"].includes(parsed.protocol) ||
			parsed.origin !== origin.replace(/\/$/, "") ||
			parsed.username ||
			parsed.password ||
			parsed.pathname !== "/" ||
			parsed.search ||
			parsed.hash
		) {
			throw new Error(`Origem inválida em FRONTEND_ORIGINS: ${origin}`);
		}
	}

	return new Set(origins.map((origin) => origin.replace(/\/$/, "")));
}

function requestedHeadersAreAllowed(value = "") {
	return value
		.split(",")
		.map((header) => header.trim().toLowerCase())
		.filter(Boolean)
		.every((header) => ALLOWED_HEADERS.has(header));
}

module.exports = function createCorsMiddleware(frontendOrigins) {
	const allowedOrigins = parseAllowedOrigins(frontendOrigins);

	return (req, res, next) => {
		const origin = req.get("origin");
		if (!origin) {
			return next();
		}

		res.vary("Origin");
		const normalizedOrigin = origin.replace(/\/$/, "");
		if (!allowedOrigins.has(normalizedOrigin)) {
			if (
				req.method === "OPTIONS" &&
				req.get("access-control-request-method")
			) {
				return res.status(403).json({ error: "Origem não permitida" });
			}
			return next();
		}

		res.set("Access-Control-Allow-Origin", normalizedOrigin);
		if (req.method === "OPTIONS" && req.get("access-control-request-method")) {
			const requestedMethod = req
				.get("access-control-request-method")
				.toUpperCase();
			if (
				!ALLOWED_METHODS.has(requestedMethod) ||
				!requestedHeadersAreAllowed(req.get("access-control-request-headers"))
			) {
				return res.status(403).json({ error: "Preflight não permitido" });
			}

			res.set("Access-Control-Allow-Methods", ALLOW_METHODS_HEADER);
			res.set("Access-Control-Allow-Headers", ALLOW_HEADERS_HEADER);
			res.set("Access-Control-Max-Age", "600");
			return res.status(204).end();
		}

		return next();
	};
};
